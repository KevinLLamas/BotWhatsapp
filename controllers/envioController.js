// Controladores
const sendMessagePost = (req, res) => {
    const { message, number } = req.body
    console.log(message, number);
    sendMessage(number, message)
    res.send({ status: 'Enviado!' })
}
module.exports={
    sendMessagePost
}