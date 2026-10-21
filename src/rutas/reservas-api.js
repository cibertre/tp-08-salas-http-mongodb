const express = require("express");
const { validarReserva } = require("../middlewares/reservas");
function crearRouterReservasApi(
  controlador,
  salasPermitidas,
  turnosPermitidos,
) {
  const router = express.Router();
  router.get("/", controlador.listarApi);
  router.get("/:id", controlador.obtenerApi);
  router.post(
    "/",
    validarReserva(salasPermitidas, turnosPermitidos),
    controlador.crearApi,
  );
  return router;
}
module.exports = { crearRouterReservasApi };
