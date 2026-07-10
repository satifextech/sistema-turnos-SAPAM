const db = require("../database/db");

class GestorTurnos {

    buscarPrimerTurno(tramites){

        return new Promise((resolve,reject)=>{

            db.get(

                `
                SELECT *
                FROM turnos
                WHERE estado='espera'
                AND tramite IN (${tramites.map(()=>"?").join(",")})
                ORDER BY id ASC
                LIMIT 1
                `,

                tramites,

                (err,row)=>{

                    if(err){

                        reject(err);
                        return;

                    }

                    resolve(row);

                }

            );

        });

    }


    contarPendientes(tramite){

        return new Promise((resolve,reject)=>{

            db.get(

                `
                SELECT COUNT(*) total
                FROM turnos
                WHERE estado='espera'
                AND tramite=?
                `,

                [tramite],

                (err,row)=>{

                    if(err){

                        reject(err);
                        return;

                    }

                    resolve(row.total);

                }

            );

        });

    }

    marcarAtendiendo(id, mesa){

        return new Promise((resolve,reject)=>{

            db.run(

                `
                UPDATE turnos
                SET
                    estado='atendiendo',
                    mesa=?,
                    fechaLlamado=CURRENT_TIMESTAMP
                WHERE id=?
                `,

                [mesa,id],

                function(err){

                    if(err){

                        reject(err);
                        return;

                    }

                    resolve();

                }

            );

        });

    }


    finalizarTurno(id){

        return new Promise((resolve,reject)=>{

            db.run(

                `
                UPDATE turnos
                SET estado='finalizado'
                WHERE id=?
                `,

                [id],

                function(err){

                    if(err){

                        reject(err);
                        return;

                    }

                    resolve();

                }

            );

        });

    }


}

module.exports = new GestorTurnos();