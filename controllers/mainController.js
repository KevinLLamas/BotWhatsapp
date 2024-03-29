const fs = require('fs');
const mimeDb = require('mime-db')
const moment = require('moment');
const ora = require('ora');
const chalk = require('chalk');
const ExcelJS = require('exceljs');
const qrcode = require('qrcode-terminal');
const { Client, MessageMedia } = require('whatsapp-web.js');
const SESSION_FILE_PATH = '../session.json';
let client;
let sessionData;
const Chats =require('../models/chats');
const Menjes =require('../models/mensajes');
const {Op} = require('sequelize');
const Mensajes = require('../models/mensajes');
express = require('express');
app = express();
app.locals.moment = require('moment');
//CASO EXISTE SESION
const withSession = () => {
    // Si exsite cargamos el archivo con las credenciales
    const spinner = ora(`Cargando ${chalk.yellow('Validando session con Whatsapp...')}`);
    sessionData = require(SESSION_FILE_PATH);
    spinner.start();
    client = new Client({
        session: sessionData
    });
    client.on('ready', () => {
        console.log('Client is ready!');
        spinner.stop();

        connectionReady();
    });
    client.on('auth_failure', () => {
        spinner.stop();
        console.log('** Error de autentificacion vuelve a generar el QRCODE (Borrar el archivo session.json) **');
    })
    client.initialize();
}

//CONECCION LISTA
const connectionReady = () => {
    listenMessage();
    //readExcel();
}

//Escuchamos cuando entre un mensaje
 const listenMessage = () => {
    client.on('message', async msg => {
        const { from, to, body } = msg;
        numero = from.replace('@c.us', '');

        //Buscamos chat con ese número
        const chat = await Chats.findOne({
            where:{
                numero : numero
            },
        });
        //console.log(chat);
        if(!chat){
            //si no existe lo creamos
            const chat = await Chats.create({
                numero: numero
            });
        }
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            saveMedia(media,chat);
            // do something with the media data here
        }
        console.log(body);
        await replyAsk(from, body, chat);
        

    });
}

//Guardamos archivos multimedia que nuestro cliente nos envie!
const saveMedia = (media,chat) => {

    const extensionProcess = mimeDb[media.mimetype];
    const ext = extensionProcess.extensions[0];
    let dir = `./storage/${chat.numero}`;
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
    
    if(!media.filename){
        media.fileName = moment().format('MM-DD-YY H-MI-SS');
    }
    let path = `${dir}/${media.filename}.${ext}`;

    fs.writeFile(path, media.data, { encoding: 'base64' }, function (err) {
        console.log('Archivo Media Guardado');
        const mensaje = Mensajes.create({
            id_chat: chat.id,
            tipo: 'media',
            contenido: path,
        });
    });
}

//Enviamos archivos multimedia a nuestro cliente
const sendMedia = (number, fileName) => {
    number = number.replace('@c.us', '');
    number = `${number}@c.us`
    const media = MessageMedia.fromFilePath(`./mediaSend/${fileName}`);
    client.sendMessage(number, media);
}

// Enviamos un mensaje simple (texto) a nuestro cliente
const sendMessage = (number = null, text = null) => {
    number = number.replace('@c.us', '');
    number = `${number}@c.us`
    const message = text || `Hola soy un BOT recuerda`;
    client.sendMessage(number, message);
    readChat(number, message)
    console.log(`${chalk.red('Enviando mensajes....')}`);
}

//Response a pregunta
const replyAsk = (from, answer, chat) => new Promise((resolve, reject) => {
    console.log(`-->`, answer);
    if (answer === 'Quiero información') {
        const firstMessage = [
            'Hola, soy el ChatBot Eternity',
            '¿Que es lo que te interesa saber?',
            'Mira está información',
        ].join(' ')
        sendMessage(from, firstMessage)
        resolve(true)
    }
    if (answer === 'Quiero meme') {
        sendMedia(from, 'meme-2.png')
        resolve(true)
    }
    if(answer){
        let mensaje =  Mensajes.create({
            id_chat: chat.id,
            tipo: 'text',
            contenido: answer,
        });
    }
    
})

// Generamos un QRCODE para iniciar sesion
const withOutSession = () => {
    console.log('No tenemos session guardada');
    client = new Client();
    client.on('qr', qr => {
        qrcode.generate(qr, { small: true });
    });
    client.on('ready', () => {
        console.log('Client is ready!');
        connectionReady();
    });

    client.on('auth_failure', () => {
        console.log('** Error de autentificacion vuelve a generar el QRCODE **');
    })
    client.on('authenticated', (session) => {
        // Guardamos credenciales de de session para usar luego
        sessionData = session;
        fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
            if (err) {
                console.log(err);
            }
        });
    });
    client.initialize();
}

//Difundir mensaje a clientes
const readExcel = async () => {
    const pathExcel = `./chats/clientes-saludar.xlsx`;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(pathExcel);
    const worksheet = workbook.getWorksheet(1);
    const columnNumbers = worksheet.getColumn('A');
    columnNumbers.eachCell((cell, rowNumber) => {
        const numberCustomer = cell.value
        const columnDate = worksheet.getRow(rowNumber);
        let prevDate = columnDate.getCell(2).value;
        prevDate = moment.unix(prevDate);
        const diffMinutes = moment().diff(prevDate, 'minutes');

        // Si ha pasado mas de 60 minuitos podemos enviar nuevamente
        if (diffMinutes > 60) {
            sendMessage(numberCustomer)
            columnDate.getCell(2).value = moment().format('X')
            columnDate.commit();
        }
    });
    workbook.xlsx.writeFile(pathExcel);
}
//Guardar historial de conversacion
const readChat = async (number, message) => {
    const pathExcel = `./chats/${number}.xlsx`;
    const workbook = new ExcelJS.Workbook();
    const today = moment().format('DD-MM-YYYY hh:mm')

    if (fs.existsSync(pathExcel)) {
        //Si existe el archivo de conversacion lo actualizamos
        const workbook = new ExcelJS.Workbook();
        workbook.xlsx.readFile(pathExcel)
            .then(() => {
                const worksheet = workbook.getWorksheet(1);
                const lastRow = worksheet.lastRow;
                var getRowInsert = worksheet.getRow(++(lastRow.number));
                getRowInsert.getCell('A').value = today;
                getRowInsert.getCell('B').value = message;
                getRowInsert.commit();
                workbook.xlsx.writeFile(pathExcel);
            });
    } else {
        //NO existe el archivo de conversacion lo creamos
        const worksheet = workbook.addWorksheet('Chats');
        worksheet.columns = [
            { header: 'Fecha', key: 'number_customer' },
            { header: 'Mensajes', key: 'message' }
        ];
        worksheet.addRow([today, message]);
        workbook.xlsx.writeFile(pathExcel)
            .then(() => {

                console.log("saved");
            })
            .catch((err) => {
                console.log("err", err);
            });
    }
}

//Saludos a primera respuesta
const greetCustomer = (from) => new Promise((resolve, reject) => {
    from = from.replace('@c.us', '');
    const pathExcel = `./chats/${from}@c.us.xlsx`;
    if (!fs.existsSync(pathExcel)) {
        const firstMessage = [
            'Hola, soy el ChatBot Eternity',
            '¿Que es lo que te interesa saber?',
            'Mira está información',
        ].join(' ')

        sendMessage(from, firstMessage)
        sendMedia(from, 'meme-2.png')
    }
    resolve(true)
})


module.exports={
    withOutSession,
    withSession
}