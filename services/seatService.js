const pool = require('../config/db');

const bookSeats = async (numOfSeats) => {
  // Find a row with enough consecutive available seats
  const rowSeats = await pool.query(
    `
    SELECT row_number, ARRAY_AGG(id) AS seat_ids
    FROM seats
    WHERE is_reserved = FALSE
    GROUP BY row_number
    HAVING COUNT(id) >= $1
    ORDER BY row_number ASC
    `,
    [numOfSeats]
  );

  if (rowSeats.rows.length > 0) {
    // Prioritize booking seats in one row
    const seatIdsToBook = rowSeats.rows[0].seat_ids.slice(0, numOfSeats);

    await pool.query(
      "UPDATE seats SET is_reserved = TRUE WHERE id = ANY($1::int[])",
      [seatIdsToBook]
    );

    const bookedSeats = await pool.query(
      "SELECT * FROM seats WHERE id = ANY($1::int[])",
      [seatIdsToBook]
    );

    return bookedSeats.rows;
  } else {
    // If no single row has enough seats, find the nearest available seats
    const availableSeats = await pool.query(
      "SELECT * FROM seats WHERE is_reserved = FALSE ORDER BY row_number, seat_number LIMIT $1",
      [numOfSeats]
    );

    if (availableSeats.rows.length < numOfSeats) {
      throw new Error("Not enough available seats.");
    }

    const seatIdsToBook = availableSeats.rows.map((seat) => seat.id);

    await pool.query(
      "UPDATE seats SET is_reserved = TRUE WHERE id = ANY($1::int[])",
      [seatIdsToBook]
    );

    return availableSeats.rows;
  }
};

const getAllSeats = async () => {
  const result = await pool.query(
    "SELECT * FROM seats ORDER BY row_number, seat_number"
  );
  return result.rows;
};

const resetSeats = async () => {
  await pool.query("UPDATE seats SET is_reserved = FALSE");
};

module.exports = {
  bookSeats,
  getAllSeats,
  resetSeats,
};
