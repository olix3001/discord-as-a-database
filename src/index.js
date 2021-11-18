require('dotenv').config();

const { Client, Intents } = require('discord.js');
const signale = require('signale');
const chalk = require('chalk');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

const express = require('express');

var DBChannel;


client.on('ready', async () => {
    signale.success(`Logged in as ${chalk.yellow.bold(client.user.tag)}!`);
    DBChannel = await client.channels.fetch(process.env.DB_CHANNEL);

    //require('./fileSending').sendFile('test.zip', DBChannel);
    //require('./fileSending').downloadFile('test.zip-db6b8887-d5a8-4a4a-8990-223d1b393d9d', DBChannel);
});

async function sleep(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}


// EXPRESS API

const app = express();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fileSending = require('./fileSending');
const path = require('path');
const fs = require('fs');
const port = 3000

app.post('/upload', upload.single('file'), async (req, res) => {
    await fileSending.sendFile(path.join('..', req.file.path), DBChannel, DBChannel, res);
    fs.rmSync(path.join(__dirname, '..', req.file.path));
})

app.get('/download/:id', upload.none(), async (req, res) => {
    const id = req.params.id;
    try {
        const file = await fileSending.downloadFile(id, DBChannel);
        await sleep(200);
        res.download(file, path.parse(file).base, (err) => {
            if (!err) {
                fs.rmSync(file);
                return;
            };
            res.status(500).json({
                status: 'ERROR',
                message: 'unexpected error'
            });
        });
    } catch (e) {
        res.json({
            status: 'ERROR',
            message: 'not available or still uploading'
        });
    }
})

app.listen(port, () => {
    console.log(`Discord filebase app listening at http://localhost:${port}`)
})

client.login(process.env.TOKEN);
