module.exports = {

    1: {
        prioridad: [
            { tramite:"CONSUMO", peso:100 },
            { tramite:"AFOROS", peso:90 },
            { tramite:"CONTRATO1", peso:110 }
        ],
        apoyo:[]
    },

    2:{
        prioridad:[
            { tramite:"ABONOS", peso:100 },
            { tramite:"RECONEXIONES", peso:95 },
            { tramite:"SUSPENSION", peso:90 }
        ],
        apoyo:[
            { tramite:"CONSUMO", peso:40 },
            { tramite:"AFOROS", peso:35 }
        ]
    },

    3:{
        prioridad:[
            { tramite:"CONTRATO2", peso:110 }
        ],
        apoyo:[
            { tramite:"CONSUMO", peso:60 },
            { tramite:"AFOROS", peso:55 },
            { tramite:"ABONOS", peso:50 },
            { tramite:"RECONEXIONES", peso:45 },
            { tramite:"SUSPENSION", peso:40 }
        ]
    },

    4:{
        prioridad:[
            { tramite:"CONSUMO", peso:95 },
            { tramite:"AFOROS", peso:100 }
        ],
        apoyo:[
            { tramite:"ABONOS", peso:60 },
            { tramite:"RECONEXIONES", peso:55 },
            { tramite:"SUSPENSION", peso:50 }
        ]
    },

    5:{
        prioridad:[
            { tramite:"INSEN", peso:100 },
            { tramite:"GIRO", peso:95 }
        ],
        apoyo:[]
    }

};