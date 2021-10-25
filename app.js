const path = require('path');
let env = require('dotenv').config(path.join(__dirname,'.env'));
const fs = require('fs');
const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: true }))
const SESSION_FILE_PATH = './session.json';
const { withOutSession, withSession} = require('./controllers/mainController');
const {sendMessagePost } = require('./controllers/envioController');

(fs.existsSync(SESSION_FILE_PATH)) ? withSession() : withOutSession();

//Rutas
app.post('/send', sendMessagePost);

app.listen(process.env.PORT, () => {
    console.log('Server ready!');
})