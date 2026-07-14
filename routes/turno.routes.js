const express = require("express");

const router = express.Router();

const db = require("../database/db");

const tramites = require("../config/tramites");

router.post("/api/turno", (req, res)=>{

    const { tramite } = req.body;

    const configuracion =
        tramites[tramite];

    if(!configuracion){

        return res.status(400).json({
            success:false,
            mensaje:"Trámite inválido"
        });

    }

    db.serialize(()=>{

        db.run(
            "BEGIN IMMEDIATE TRANSACTION"
        );

        db.get(
            `
            SELECT ultimoNumero
            FROM folios
            WHERE tramite=?
            `,
            [tramite],
            (errorConsulta, fila)=>{

                if(errorConsulta){

                    db.run("ROLLBACK");

                    console.error(
                        "Error al consultar folio:",
                        errorConsulta
                    );

                    return res.status(500).json({
                        success:false,
                        mensaje:"No se pudo generar el turno"
                    });

                }

                const siguienteNumero =
                    Number(fila?.ultimoNumero || 0) + 1;

                const codigo =
                    configuracion.prefijo
                    + String(siguienteNumero).padStart(3, "0");

                db.run(
                    `
                    UPDATE folios
                    SET
                        ultimoNumero=?,
                        fechaReinicio=fechaReinicio
                    WHERE tramite=?
                    `,
                    [
                        siguienteNumero,
                        tramite
                    ],
                    function(errorFolio){

                        if(errorFolio){

                            db.run("ROLLBACK");

                            console.error(
                                "Error al actualizar folio:",
                                errorFolio
                            );

                            return res.status(500).json({
                                success:false,
                                mensaje:"No se pudo generar el turno"
                            });

                        }

                        db.run(
                            `
                            INSERT INTO turnos
                            (
                                codigo,
                                tramite
                            )
                            VALUES (?,?)
                            `,
                            [
                                codigo,
                                tramite
                            ],
                            function(errorTurno){

                                if(errorTurno){

                                    db.run("ROLLBACK");

                                    console.error(
                                        "Error al guardar turno:",
                                        errorTurno
                                    );

                                    return res.status(500).json({
                                        success:false,
                                        mensaje:"No se pudo guardar el turno"
                                    });

                                }

                                db.run(
                                    "COMMIT",
                                    errorCommit => {

                                        if(errorCommit){

                                            console.error(
                                                "Error al confirmar turno:",
                                                errorCommit
                                            );

                                            return res.status(500).json({
                                                success:false,
                                                mensaje:"No se pudo confirmar el turno"
                                            });

                                        }

                                        res.json({
                                            success:true,
                                            id:this.lastID,
                                            codigo,
                                            tramite:
                                                configuracion.nombre
                                        });

                                    }
                                );

                            }

                        );

                    }
                );

            }
        );

    });

});

module.exports = router;