const mesas = require("../config/mesas");
const tramites = require("../config/tramites");
const reglasApoyo = require("../config/reglasApoyo");
const db = require("../database/db");
const gestorTurnos = require("./gestorTurnos");
const gestorMesa = require("./gestorMesa");

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

    obtenerMesasPrioritarias(tramite){

        const resultado = [];

        for(const numero in this.mesas){

            const configuracion =
                this.mesas[numero];

            const esPrioritaria =
                configuracion.prioridad.some(
                    regla =>
                        regla.tramite === tramite
                );

            if(esPrioritaria){

                resultado.push(
                    Number(numero)
                );

            }

        }

        return resultado;

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
        await gestorTurnos.contarPendientes(
            tramite
        );

    if(pendientes === 0){
        return false;
    }

    const mesasPrioritarias =
        this.obtenerMesasPrioritarias(
            tramite
        );

    const existePrioritariaDisponible =
        await gestorMesa.hayMesaDisponible(
            mesasPrioritarias
        );

    /*
    Si ninguna mesa prioritaria está disponible,
    una mesa de apoyo puede atender desde el
    primer turno pendiente.
    */
    if(!existePrioritariaDisponible){
        return true;
    }

    const limite =
        this.reglasApoyo[tramite];

    return pendientes >= limite;

}


    async buscarTurnoPrioridad(mesa){

        const mesaConfig =
            this.obtenerMesa(mesa);

        /*
        Una mesa dinámica nueva todavía puede no tener
        reglas asignadas. En ese caso no buscamos turno.
        */
        if(
            !mesaConfig
            || !Array.isArray(mesaConfig.prioridad)
            || mesaConfig.prioridad.length === 0
        ){

            return null;

        }

        const tramites =
            mesaConfig.prioridad.map(
                regla => regla.tramite
            );

        return await gestorTurnos
            .buscarPrimerTurno(tramites);

    }


    async buscarTurnoApoyo(mesa){

        const mesaConfig =
            this.obtenerMesa(mesa);

        if(
            !mesaConfig
            || !Array.isArray(mesaConfig.apoyo)
            || mesaConfig.apoyo.length === 0
        ){

            return null;

        }

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