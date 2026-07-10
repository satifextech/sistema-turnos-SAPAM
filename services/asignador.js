const mesas = require("../config/mesas");
const tramites = require("../config/tramites");
const reglasApoyo = require("../config/reglasApoyo");
const db = require("../database/db");
const gestorTurnos = require("./gestorTurnos");

class Asignador {

    constructor() {

        this.mesas = mesas;
        this.tramites = tramites;
        this.reglasApoyo = reglasApoyo;

    }

    /*obtenerReglas(tramite){

        return this.reglas.tramites[tramite];

    }*/

    obtenerMesa(mesa){

        return this.mesas[mesa];

    }

    obtenerTramite(tramite){

        return this.tramites[tramite];

    }



    async buscarTurno(mesa){

        let turno =
            await this.buscarTurnoPrioridad(mesa);

        if(turno){

            return turno;

        }

        turno =
            await this.buscarTurnoApoyo(mesa);

        return turno;

    }


    async necesitaApoyo(tramite){

        const pendientes =
            await gestorTurnos.contarPendientes(tramite);

        const limite = 
            this.reglasApoyo[tramite];

        return pendientes >= limite;

    }


    async buscarTurnoPrioridad(mesa){

        const mesaConfig = this.obtenerMesa(mesa);

        const tramites =
            mesaConfig.prioridad.map(t=>t.tramite);

        return await gestorTurnos.buscarPrimerTurno(tramites);

}


    async buscarTurnoApoyo(mesa){

        const mesaConfig =
            this.obtenerMesa(mesa);

        for(const apoyo of mesaConfig.apoyo){

            const tramite = apoyo.tramite;

            const necesita =
                await this.necesitaApoyo(tramite);

            if(!necesita){

                continue;

            }

            const turno = await new Promise((resolve,reject)=>{

                db.get(

                    `
                    SELECT *
                    FROM turnos
                    WHERE estado='espera'
                    AND tramite=?
                    ORDER BY id ASC
                    LIMIT 1
                    `,

                    [tramite],

                    (err,row)=>{

                        if(err){

                            reject(err);
                            return;

                        }

                        resolve(row);

                }

            );

        });

        if(turno){

            return turno;

        }

    }

    return null;

}



}

module.exports = new Asignador();