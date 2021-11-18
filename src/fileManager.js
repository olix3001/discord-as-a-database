const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const signale = require('signale');
const { v4: uuidv4 } = require('uuid')

module.exports = {
    async shardFile(filePath, maxShardSize) {
        const rawFileName = path.parse(filePath).base;
        const fileName = `${path.parse(filePath).base}-${uuidv4()}`;
        const shards = [];
        const readStream = fs.createReadStream(filePath, { highWaterMark: maxShardSize, encoding: 'binary' });

        // create directory in temp
        fs.mkdirSync(path.join(__dirname, 'temp', fileName));
        signale.time(fileName);

        for await (const chunk of readStream) {
            // create chunk file
            const shardName = uuidv4();
            shards.push(shardName);
            fs.writeFileSync(path.join(__dirname, 'temp', fileName, shardName), chunk, { encoding: 'binary' });
            signale.info(`Written shard ${chalk.yellow(shardName)} of file ${chalk.green(fileName)}`);
        }

        // write manifest file
        const manifest = path.join(__dirname, 'temp', fileName, 'manifest.json');
        fs.writeFileSync(manifest, JSON.stringify({
            id: fileName,
            name: rawFileName,
            shards: shards
        }));
        signale.timeEnd(fileName);

        return manifest;
    },

    async constructFile(manifestPath, options) {
        options = options || {};
        const o = {
            deleteShards: options.deleteShards || false
        };

        const shardsPath = path.parse(manifestPath).dir;

        // get info about this file
        const fileInfo = JSON.parse(fs.readFileSync(manifestPath));
        signale.time(fileInfo.name);

        // open writestream
        const ws = fs.createWriteStream(path.join(__dirname, 'temp', fileInfo.name), 'binary');
        for (let shard of fileInfo.shards) {
            const sp = path.join(shardsPath, shard);
            ws.write(fs.readFileSync(sp));
            if (o.deleteShards) fs.rmSync(sp);
            signale.info(`Constructed shard ${chalk.yellow(shard)}`);
        }

        if (o.deleteShards) {
            fs.rmSync(manifestPath);
            if (fs.readdirSync(shardsPath).length == 0)
                fs.rmdirSync(shardsPath);
        }

        ws.close();
        signale.timeEnd(fileInfo.name);

        return path.join(__dirname, 'temp', fileInfo.name);
    }
}