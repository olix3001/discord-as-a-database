# Discord as a database
This project is my attempt to use discord chat as a database for files

# How to use
1. download all dependencies using `npm install`

2. create .env file in main directory and make it look like
```
TOKEN=<bot token>
DB_CHANNEL=<database channel id>
READ_WRITE_SPEED=<how many messages per second to send (2 is recommended)>
```

3. type in `npm start` command in main project directory

4. open html file in `test/` directory and upload your file

5. go to `localhost:3000/download/<id>` where `<id>` is the one that you got from uploading a file to download it again

# Known issues
Web browser may break upload or download if it takes too long