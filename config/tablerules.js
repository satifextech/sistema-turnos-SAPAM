module.exports = {

    /*tramites: {

        CONSUMO: {
            nombre: "Consumo Alto",
            prioridad: [1, 4],
            apoyo: [3, 2],
            limiteApoyo: 5
        },

        AFOROS: {
            nombre: "Aforos",
            prioridad: [4, 1],
            apoyo: [3, 2],
            limiteApoyo: 5
        },

        ABONOS: {
            nombre: "Abonos",
            prioridad: [2],
            apoyo: [4, 3],
            limiteApoyo: 5
        },

        CONTRATO1: {
            nombre: "Contratos Etapa 1",
            prioridad: [1],
            apoyo: [],
            limiteApoyo: 999
        },

        CONTRATO2: {
            nombre: "Contratos Etapa 2",
            prioridad: [3],
            apoyo: [],
            limiteApoyo: 999
        },

        RECONEXIONES: {
            nombre: "Reconexiones",
            prioridad: [2],
            apoyo: [4, 3],
            limiteApoyo: 5
        },

        SUSPENSION: {
            nombre: "Suspensión Voluntaria",
            prioridad: [2],
            apoyo: [4, 3],
            limiteApoyo: 5
        },

        INSEN: {
            nombre: "INSEN",
            prioridad: [5],
            apoyo: [],
            limiteApoyo: 999
        },

        GIRO: {
            nombre: "Giro Tarifa",
            prioridad: [5],
            apoyo: [],
            limiteApoyo: 999
        }

    }


    ,*/

mesas: {

    1: {
        prioridad: ["CONSUMO", "AFOROS", "CONTRATO1"],
        apoyo: []
    },

    2: {
        prioridad: ["ABONOS", "RECONEXIONES", "SUSPENSION"],
        apoyo: ["CONSUMO", "AFOROS"]
    },

    3: {
        prioridad: ["CONTRATO2"],
        apoyo: [
            "CONSUMO",
            "AFOROS",
            "ABONOS",
            "RECONEXIONES",
            "SUSPENSION"
        ]
    },

    4: {
        prioridad: [
            "CONSUMO",
            "AFOROS"
        ],
        apoyo: [
            "ABONOS",
            "RECONEXIONES",
            "SUSPENSION"
        ]
    },

    5: {
        prioridad: [
            "INSEN",
            "GIRO"
        ],
        apoyo: []
    }

}


};