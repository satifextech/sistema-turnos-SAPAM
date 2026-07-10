const express = require("express");

const router = express.Router();

const db = require("../database/db");

const tramites = require("../config/tramites");

router.post("/api/turno", (req,res)=>{

    const { tramite } = req.body;

    db.get(

        `
        SELECT COUNT(*) as total
        FROM turnos
        WHERE tramite = ?
        `,

        [tramite],

        (err,row)=>{

            const numero = row.total + 1;

            const prefijo = tramites[tramite].prefijo;

            const codigo =
                prefijo +
                String(numero).padStart(3,"0");

            db.run(

                `
                INSERT INTO turnos
                (codigo, tramite)
                VALUES (?,?)
                `,

                [codigo, tramite],

                ()=>{

                    res.json({
                        codigo
                    });

                }

            );

        }

    );

});

module.exports = router;