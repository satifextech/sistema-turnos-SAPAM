const express = require("express");

const router = express.Router();

const db = require("../database/db");

const tramites = require("../config/tramites");

const gestorTramites = require("../services/gestorTramites");

router.post("/api/turno", async (req, res)=>{

    const tramite =
        String(req.body.tramite || "")
            .trim()
            .toUpperCase();

    try{

        const configuracion =
            await gestorTramites
                .buscarPorCodigo(tramite);

        if(
            !configuracion
            || Number(configuracion.activo) !== 1
            || Number(
                configuracion.mostrarRecepcion
            ) !== 1
        ){

            return res.status(400).json({
                success:false,
                mensaje:
                    "El trámite no está disponible"
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
                            mensaje:
                                "No se pudo generar el turno"
                        });

                    }

                    const siguienteNumero =
                        Number(
                            fila?.ultimoNumero || 0
                        ) + 1;

                    const codigo =
                        configuracion.prefijo
                        + String(
                            siguienteNumero
                        ).padStart(3, "0");

                    db.run(
                        `
                        INSERT OR IGNORE INTO folios
                        (
                            tramite,
                            ultimoNumero
                        )
                        VALUES (?, 0)
                        `,
                        [tramite],
                        errorInsertarFolio => {

                            if(errorInsertarFolio){

                                db.run("ROLLBACK");

                                return res.status(500).json({
                                    success:false,
                                    mensaje:
                                        "No se pudo preparar el folio"
                                });

                            }

                            db.run(
                                `
                                UPDATE folios
                                SET ultimoNumero=?
                                WHERE tramite=?
                                `,
                                [
                                    siguienteNumero,
                                    tramite
                                ],
                                errorFolio => {

                                    if(errorFolio){

                                        db.run("ROLLBACK");

                                        console.error(
                                            "Error al actualizar folio:",
                                            errorFolio
                                        );

                                        return res.status(500).json({
                                            success:false,
                                            mensaje:
                                                "No se pudo generar el folio"
                                        });

                                    }

                                    db.run(
                                        `
                                        INSERT INTO turnos
                                        (
                                            codigo,
                                            tramite
                                        )
                                        VALUES (?, ?)
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
                                                    mensaje:
                                                        "No se pudo guardar el turno"
                                                });

                                            }

                                            const idTurno =
                                                this.lastID;

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
                                                            mensaje:
                                                                "No se pudo confirmar el turno"
                                                        });

                                                    }

                                                    res.status(201).json({
                                                        success:true,
                                                        id:idTurno,
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

                }
            );

        });

    }catch(error){

        console.error(
            "Error al generar turno:",
            error
        );

        res.status(500).json({
            success:false,
            mensaje:
                "No se pudo generar el turno"
        });

    }

});

module.exports = router;