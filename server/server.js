const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();

const server = http.createServer(app);

const io = new Server(server);

app.use(express.static(path.join(__dirname, "../public")));

io.on("connection", (socket) => {

    console.log("Cliente conectado");

    socket.on("disconnect", () => {
        console.log("Cliente desconectado");
    });

});

app.get("/", (req, res) => {
    res.send("Servidor funcionando");
});

server.listen(3000, () => {
    console.log("Servidor en puerto 3000");
});