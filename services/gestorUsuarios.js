const db = require("../database/db");

class GestorUsuarios {

    buscarPorUsuario(usuario){

        return new Promise((resolve, reject)=>{

            db.get(
                `
                SELECT
                    id,
                    usuario,
                    contraseña,
                    rol,
                    activo

                FROM usuarios

                WHERE usuario=?
                LIMIT 1
                `,
                [usuario],
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

    listarUsuarios(){

        return new Promise((resolve, reject)=>{

            db.all(
                `
                SELECT
                    id,
                    usuario,
                    rol,
                    activo,
                    fechaCreacion

                FROM usuarios

                ORDER BY
                    activo DESC,
                    usuario ASC
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


    crearUsuario(
        usuario,
        contraseña,
        rol
    ){

        return new Promise((resolve, reject)=>{

            db.run(
                `
                INSERT INTO usuarios
                (
                    usuario,
                    contraseña,
                    rol,
                    activo
                )
                VALUES (?, ?, ?, 1)
                `,
                [
                    usuario,
                    contraseña,
                    rol
                ],
                function(err){

                    if(err){
                        reject(err);
                        return;
                    }

                    resolve({
                        id:this.lastID
                    });

                }
            );

        });

    }


    cambiarEstadoUsuario(
        id,
        activo
    ){

        return new Promise((resolve, reject)=>{

            db.run(
                `
                UPDATE usuarios
                SET activo=?
                WHERE id=?
                `,
                [
                    activo ? 1 : 0,
                    id
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


    restablecerContraseña(
        id,
        contraseña
    ){

        return new Promise((resolve, reject)=>{

            db.run(
                `
                UPDATE usuarios
                SET contraseña=?
                WHERE id=?
                `,
                [
                    contraseña,
                    id
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

    cambiarContraseña(id, nuevaContraseña){

        return new Promise((resolve, reject)=>{

            db.run(
                `
                UPDATE usuarios
                SET contraseña=?
                WHERE id=?
                `,
                [
                    nuevaContraseña,
                    id
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

    buscarPorId(id){

        return new Promise((resolve, reject)=>{

            db.get(
                `
                SELECT
                    id,
                    usuario,
                    rol,
                    activo

                FROM usuarios

                WHERE id=?
                LIMIT 1
                `,
                [id],
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


    contarAdministradoresActivos(){

        return new Promise((resolve, reject)=>{

            db.get(
                `
                SELECT COUNT(*) AS total

                FROM usuarios

                WHERE
                    rol='admin'
                    AND activo=1
                `,
                [],
                (err, fila)=>{

                    if(err){
                        reject(err);
                        return;
                    }

                    resolve(
                        Number(fila.total || 0)
                    );

                }
            );

        });

    }


    eliminarUsuario(id){

        return new Promise((resolve, reject)=>{

            db.run(
                `
                DELETE FROM usuarios
                WHERE id=?
                `,
                [id],
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

module.exports = new GestorUsuarios();