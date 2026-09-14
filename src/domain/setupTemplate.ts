// Plantilla de ejemplo de configuración inicial (contracts/setup-import.md). Se descarga desde Ajustes.
import { SETUP_FORMAT, SETUP_VERSION } from "./setupImport.ts";

export const SETUP_TEMPLATE = {
  formato: SETUP_FORMAT,
  version: SETUP_VERSION,
  gruposMusculares: ["Core"],
  ejercicios: [
    { nombre: "Press banca", catalogo: "Barbell Bench Press - Medium Grip" },
    { nombre: "Sentadilla", catalogo: "Barbell Squat" },
    { nombre: "Peso muerto rumano", catalogo: "Romanian Deadlift", primarios: ["Isquiotibiales", "Glúteos"], secundarios: ["Zona lumbar"] },
    { nombre: "Dominadas", catalogo: "Pullups" },
    { nombre: "Remo con barra", catalogo: "Bent Over Barbell Row" },
    { nombre: "Press militar", catalogo: "Standing Military Press" },
    { nombre: "Rueda abdominal", primarios: ["Core"], secundarios: ["Hombros"], equipamiento: "Rueda" },
  ],
  rutinas: [
    {
      nombre: "Torso A",
      ejercicios: [
        { ejercicio: "Press banca", series: 3, repeticiones: [6, 8], rir: 2 },
        { ejercicio: "Dominadas", series: 3, repeticiones: [6, 10], rir: 2 },
        { ejercicio: "Press militar", series: 3, repeticiones: [8, 10], rir: 2 },
        { ejercicio: "Remo con barra", series: 3, repeticiones: [8, 10], rir: 2 },
      ],
    },
    {
      nombre: "Pierna A",
      ejercicios: [
        { ejercicio: "Sentadilla", series: 4, repeticiones: [5, 8], rir: 2 },
        { ejercicio: "Peso muerto rumano", series: 3, repeticiones: [8, 10], rir: 2 },
        { ejercicio: "Rueda abdominal", series: 3, repeticiones: 10, rir: 3 },
      ],
    },
  ],
  ingredientes: [
    {
      nombre: "Arroz blanco",
      unidad: "g",
      kcal: 350,
      proteinas: 7,
      hidratos: 77,
      grasas: 0.6,
      seccion: "Despensa",
      formatoCompra: { nombre: "paquete", cantidad: 1000 },
      medidas: [{ nombre: "vaso", cantidad: 180 }],
    },
    {
      nombre: "Pechuga de pollo",
      unidad: "g",
      kcal: 110,
      proteinas: 23,
      hidratos: 0,
      grasas: 1.5,
      seccion: "Carnicería",
      formatoCompra: { nombre: "bandeja", cantidad: 500 },
    },
    {
      nombre: "Aceite de oliva virgen extra",
      unidad: "ml",
      kcal: 824,
      proteinas: 0,
      hidratos: 0,
      grasas: 91.6,
      seccion: "Despensa",
      formatoCompra: { nombre: "botella", cantidad: 1000 },
      medidas: [
        { nombre: "cucharada", cantidad: 13.5 },
        { nombre: "cucharadita", cantidad: 4.5 },
      ],
    },
    { nombre: "Huevo", unidad: "g", kcal: 143, proteinas: 12.6, hidratos: 0.7, grasas: 9.5, seccion: "Huevos", formatoCompra: { nombre: "docena", cantidad: 720 }, medidas: [{ nombre: "unidad", cantidad: 60 }] },
  ],
  recetas: [
    {
      nombre: "Arroz con pollo",
      raciones: 2,
      ingredientes: [
        { ingrediente: "Arroz blanco", cantidad: 160 },
        { ingrediente: "Pechuga de pollo", cantidad: 300 },
        { ingrediente: "Aceite de oliva virgen extra", cantidad: 20 },
      ],
      pasos: ["Dorar el pollo troceado en el aceite", "Añadir el arroz y el doble de agua", "Cocer 18 minutos"],
    },
  ],
  momentos: [
    { nombre: "Desayuno", inicio: "07:00" },
    { nombre: "Comida", inicio: "13:30" },
    { nombre: "Merienda", inicio: "17:30" },
    { nombre: "Cena", inicio: "21:00" },
  ],
  objetivos: [{ desde: "2026-09-14", kcal: 2500, proteinas: 160, hidratos: null, grasas: 70 }],
  tiposMedida: ["Cintura", "Cadera", "Brazo"],
};
