function crearControladorReservas(servicio, salasPermitidas, turnosPermitidos) {
  async function listar(req, res) {
    const reservas = await servicio.listar();
    res.render("reservas/lista", {
      titulo: "Reservas de salas",
      reservas,
    });
  }
  function mostrarFormulario(req, res) {
    res.render("reservas/nueva", {
      titulo: "Nueva reserva",
      errores: null,
      valores: {},
      salas: salasPermitidas,
      turnos: turnosPermitidos,
    });
  }
  async function mostrarDetalle(req, res) {
    const reserva = await servicio.obtenerPorId(req.params.id);
    if (!reserva) {
      return res.status(404).render("no-encontrado", {
        titulo: "Reserva no encontrada",
        mensaje: "No existe una reserva con ese identificador.",
      });
    }
    res.render("reservas/detalle", { titulo: reserva.estudiante, reserva });
  }
  async function crear(req, res) {
    try {
      // Usar req.body o req.reservaValidada según cómo devuelva los datos tu middleware
      const datos = req.reservaValidada || req.body;
      const nuevaReserva = await servicio.crear(datos);

      // Si la petición viene de la API (por ejemplo, si la ruta incluye /api/)
      if (req.baseUrl.includes("/api")) {
        return res
          .status(201)
          .location(`${req.baseUrl}/${nuevaReserva.id}`)
          .json(nuevaReserva);
      }

      res.redirect("/reservas");
    } catch (error) {
      console.error("Error al crear reserva:", error);
      if (req.baseUrl.includes("/api")) {
        return res
          .status(500)
          .json({ error: "Error interno al crear la reserva" });
      }
      // Manejo de errores para la vista web...
    }
  }
  async function obtenerApi(req, res) {
    const reserva = await servicio.obtenerPorId(req.params.id);
    if (!reserva) {
      return res
        .status(404)
        .json({ error: "No existe una reserva con ese identificador." });
    }
    res.json(reserva);
  }
  async function listarApi(req, res) {
    try {
      const sala = req.query.sala;
      if (sala !== undefined && typeof sala !== "string") {
        return res
          .status(400)
          .json({ error: "El filtro sala debe ser un único texto." });
      }
      // Si filtrar por sala opcionalmente:
      const filtro = req.query.sala ? { sala: req.query.sala } : {};
      const reservas = await servicio.listar(filtro); // O simplemente await servicio.listar();
      res.json(reservas);
    } catch (error) {
      console.error("Error al listar reservas en la API:", error);
      res.status(500).json({ error: "Error interno al obtener las reservas." });
    }
  }
  return {
    listar,
    mostrarFormulario,
    mostrarDetalle,
    crear,
    listarApi,
    obtenerApi,
    crearApi: crear,
  };
}
module.exports = { crearControladorReservas };
