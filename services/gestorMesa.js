const db = require("../database/db");

class GestorMesa {

    obtenerEstado(numero){

        return new Promise((resolve, reject)=>{

            db.get(
                `
                SELECT
                    numero,
                    estado,
                    motivo,
                    fechaActualizacion

                FROM mesas_estado

                WHERE numero=?
                `,
                [numero],
                (err, fila)=>{

                    if(err){
                        reject(err);
                        return;
                    }

                    resolve(
                        fila || {
                            numero,
                            estado:"disponible",
                            motivo:null
                        }
                    );

                }
            );

        });

    }


    obtenerEstados(){

        return new Promise((resolve, reject)=>{

            db.all(
                `
                SELECT
                    numero,
                    estado,
                    motivo,
                    fechaActualizacion

                FROM mesas_estado

                ORDER BY numero ASC
                `,
                [],
                (err, filas)=>{

                    if(err){
                        reject(err);
                        return;
                    }

                    resolve(filas);

                }
            );

        });

    }


    cambiarEstado(numero, estado, motivo = null){

        return new Promise((resolve, reject)=>{

            db.run(
                `
                INSERT INTO mesas_estado
                (
                    numero,
                    estado,
                    motivo,
                    fechaActualizacion
                )
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)

                ON CONFLICT(numero)
                DO UPDATE SET

                    estado=excluded.estado,

                    motivo=excluded.motivo,

                    fechaActualizacion=CURRENT_TIMESTAMP
                `,
                [
                    numero,
                    estado,
                    motivo
                ],
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


    hayMesaDisponible(numeros){

        if(!Array.isArray(numeros) || numeros.length === 0){
            return Promise.resolve(false);
        }

        return new Promise((resolve, reject)=>{

            const marcadores =
                numeros.map(()=>"?").join(",");

            db.get(
                `
                SELECT COUNT(*) AS total

                FROM mesas_estado

                WHERE
                    numero IN (${marcadores})
                    AND estado='disponible'
                `,
                numeros,
                (err, fila)=>{

                    if(err){
                        reject(err);
                        return;
                    }

                    resolve(
                        Number(fila.total) > 0
                    );

                }
            );

        });

    }

}

module.exports = new GestorMesa();