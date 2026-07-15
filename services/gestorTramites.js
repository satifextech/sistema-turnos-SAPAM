const db = require("../database/db");

class GestorTramites {

    listarTodos(){

        return new Promise((resolve, reject)=>{

            db.all(
                `
                SELECT
                    codigo,
                    nombre,
                    prefijo,
                    descripcion,
                    activo,
                    mostrarRecepcion,
                    orden,
                    fechaCreacion,
                    fechaActualizacion

                FROM tramites_config

                ORDER BY
                    orden ASC,
                    nombre ASC
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


    listarRecepcion(){

        return new Promise((resolve, reject)=>{

            db.all(
                `
                SELECT
                    codigo,
                    nombre,
                    prefijo,
                    descripcion,
                    orden

                FROM tramites_config

                WHERE
                    activo=1
                    AND mostrarRecepcion=1

                ORDER BY
                    orden ASC,
                    nombre ASC
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


    buscarPorCodigo(codigo){

        return new Promise((resolve, reject)=>{

            db.get(
                `
                SELECT
                    codigo,
                    nombre,
                    prefijo,
                    descripcion,
                    activo,
                    mostrarRecepcion,
                    orden

                FROM tramites_config

                WHERE codigo=?
                LIMIT 1
                `,
                [codigo],
                (err, fila)=>{

                    if(err){
                        reject(err);
                        return;
                    }

                    resolve(fila || null);

                }
            );

        });

    }


    buscarPorPrefijo(prefijo){

        return new Promise((resolve, reject)=>{

            db.get(
                `
                SELECT codigo
                FROM tramites_config
                WHERE prefijo=?
                LIMIT 1
                `,
                [prefijo],
                (err, fila)=>{

                    if(err){
                        reject(err);
                        return;
                    }

                    resolve(fila || null);

                }
            );

        });

    }


    crear(datos){

        return new Promise((resolve, reject)=>{

            db.run(
                `
                INSERT INTO tramites_config
                (
                    codigo,
                    nombre,
                    prefijo,
                    descripcion,
                    activo,
                    mostrarRecepcion,
                    orden
                )
                VALUES (?, ?, ?, ?, 1, 1, ?)
                `,
                [
                    datos.codigo,
                    datos.nombre,
                    datos.prefijo,
                    datos.descripcion || null,
                    datos.orden
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


    actualizar(codigo, datos){

        return new Promise((resolve, reject)=>{

            db.run(
                `
                UPDATE tramites_config
                SET
                    nombre=?,
                    prefijo=?,
                    descripcion=?,
                    activo=?,
                    mostrarRecepcion=?,
                    orden=?,
                    fechaActualizacion=CURRENT_TIMESTAMP

                WHERE codigo=?
                `,
                [
                    datos.nombre,
                    datos.prefijo,
                    datos.descripcion || null,
                    datos.activo ? 1 : 0,
                    datos.mostrarRecepcion ? 1 : 0,
                    datos.orden,
                    codigo
                ],
                function(err){

                    if(err){
                        reject(err);
                        return;
                    }

                    resolve(this.changes);

                }
            );

        });

    }

}

module.exports = new GestorTramites();