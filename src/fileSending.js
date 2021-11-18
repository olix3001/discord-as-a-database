const path = require('path');
const fs = require('fs');

const sharding = require('./fileManager');
const signale = require('signale');
const chalk = require('chalk');
const http = require('https');

async function sleep(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

function downloadAsStream(url, destination) {
    return new Promise((resolve, reject) => {
        var f = fs.createWriteStream(destination);
        var req = http.get(url, (res) => {
            res.pipe(f);
            f.on('finish', () => {
                f.close();
                resolve();
            });
            f.on('error', () => {
                fs.unlink(destination);
                reject();
            })
        })
    });
}

async function searchForMessage(text, channel) {
    var message = await channel.messages.fetch().then(msgs => msgs.filter(msg => msg.content == text));
    message = message.first();
    return message;
}


module.exports = {
    async sendFile(filePath, MANIFEST_CHANNEL, SHARDS_CHANNEL, response) {
        SHARDS_CHANNEL = SHARDS_CHANNEL || MANIFEST_CHANNEL;
        filePath = path.join(__dirname, filePath);

        // read manifest directory and read manifest data
        const manifest = await sharding.shardFile(filePath, 8 * 1024 * 1024);
        const fileInfo = JSON.parse(fs.readFileSync(manifest));
        if (response) response.json({
            id: fileInfo.id
        });

        signale.time(`UPLOAD: ${fileInfo.id}`);

        // send each shard
        const shardsDir = path.parse(manifest).dir;
        const n = fileInfo.shards.length;
        var i = 1;
        for (let shard of fileInfo.shards) {
            const start = new Date();
            const shardPath = path.join(shardsDir, shard);
            await SHARDS_CHANNEL.send({ content: `$SHARD:${shard}`, files: [shardPath] });
            // be aware of rate limit
            const timeTaken = (new Date() - start);
            let sleepTime = (1000 / process.env.READ_WRITE_SPEED) - timeTaken;
            if (sleepTime > 0)
                sleep(sleepTime);

            const estTime = timeTaken * (n - i) / 1000;
            signale.info(`Uploaded ${chalk.yellow(`${i}/${n}`)} (est. time left [s]: ${chalk.green(estTime)})`);
            ++i;
        }

        // send manifest message
        await MANIFEST_CHANNEL.send({
            files: [manifest],
            content: `$FILE:${fileInfo.id}`
        });

        signale.timeEnd(`UPLOAD: ${fileInfo.id}`);

        fs.rmSync(shardsDir, { recursive: true });
        return fileInfo.id;
    },

    async downloadFile(id, MANIFEST_CHANNEL, SHARDS_CHANNEL) {
        SHARDS_CHANNEL = SHARDS_CHANNEL || MANIFEST_CHANNEL;

        const manifestMessage = await searchForMessage(`$FILE:${id}`, MANIFEST_CHANNEL);
        const manifestURL = manifestMessage.attachments.first().url;
        const tempDir = path.join(__dirname, 'temp', id);
        fs.mkdirSync(tempDir);
        await downloadAsStream(manifestURL, path.join(tempDir, 'manifest.json'));

        // read manifest to get shards
        const fileInfo = JSON.parse(fs.readFileSync(path.join(tempDir, 'manifest.json')));

        signale.time(`Download: ${id}`);
        // download all shards
        for (let shard of fileInfo.shards) {
            let shardMessage = await searchForMessage(`$SHARD:${shard}`, SHARDS_CHANNEL);
            let shardURL = shardMessage.attachments.first().url;
            await downloadAsStream(shardURL, path.join(tempDir, shard));
        }
        signale.timeEnd(`Download: ${id}`);

        return await sharding.constructFile(path.join(tempDir, 'manifest.json'), { deleteShards: true });
    }
}