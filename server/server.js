const asignador = require("../services/asignador");
const db = require("../database/db");
const express = require("express");
const turnoRoutes = require("../routes/turno.routes");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const gestorTurnos = require("../services/gestorTurnos");

const app = express();

app.use(express.json());

app.use(turnoRoutes);

const server = http.createServer(app);

const io = new Server(server);

app.use(express.static(path.join(__dirname, "../public")));

app.get("/mesa/:numero", (req,res)=>{

    res.sendFile(
        path.join(
            __dirname,
            "../public/mesa/index.html"
        )
    );

});

io.on("connection", (socket) => {

    console.log("Cliente conectado");

    socket.on("disconnect", () => {
        console.log("Cliente desconectado");
    });

});

app.get("/", (req, res) => {
    res.send("Servidor funcionando");
});

app.post("/api/llamar", async (req, res) => {

    const { mesa } = req.body;

    try {

        const turno = await asignador.buscarTurno(mesa);

        if (!turno) {

            return res.json({
                success: false,
                mensaje: "Sin turnos"
            });

        }

        await gestorTurnos.marcarAtendiendo(
            turno.id,
            mesa
        );

        io.emit("nuevoTurno", {
            codigo: turno.codigo,
            mesa
        });

        res.json({
            success:true,
            id: turno.id,
            codigo:turno.codigo,
            mesa
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            mensaje: "Error interno"
        });

    }

});


app.post("/api/finalizar", async (req, res) => {

    const { id } = req.body;

    try {

        await gestorTurnos.finalizarTurno(id);

        res.json({
            success: true
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false
        });

    }

});


server.listen(3000, () => {
    console.log("Servidor en puerto 3000");
});