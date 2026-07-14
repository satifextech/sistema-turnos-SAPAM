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

}

module.exports = new GestorUsuarios();