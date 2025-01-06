const pool = require("../config/db");

// Function to book seats
const bookSeats = async (numOfSeats) => {
  // Fetch all unreserved seats ordered by row and seat number
  const availableSeats = await pool.query(
    "SELECT id, row_number, seat_number FROM seats WHERE is_reserved = FALSE ORDER BY row_number, seat_number ASC"
  );

  if (availableSeats.rows.length < numOfSeats) {
    throw new Error("Not enough available seats.");
  }

  const rowCount = 12; // assuming 12 rows

  // Try to book all seats in the same row
  for (let row = 1; row <= rowCount; row++) {
    const rowSeats = availableSeats.rows.filter(seat => seat.row_number === row);
    const availableSeatsInRow = rowSeats.filter(seat => !seat.is_reserved);

    if (availableSeatsInRow.length >= numOfSeats) {
      const seatsToBook = availableSeatsInRow.slice(0, numOfSeats);
      for (let i = 0; i < seatsToBook.length; i++) {
        const seat = seatsToBook[i];
        await pool.query("UPDATE seats SET is_reserved = TRUE WHERE id = $1", [seat.id]);
      }
      return { status: 200, data: seatsToBook };
    }
  }

  // If not enough seats in the same row, find nearby seats in different rows
  const rowAvailability = Array.from({ length: rowCount }, (_, row) => {
    const rowSeats = availableSeats.rows.filter(seat => seat.row_number === row + 1);
    return rowSeats.filter(seat => !seat.is_reserved).length;
  });

  let minLength = Infinity;
  let minStart = -1;
  let minEnd = -1;
  let start = 0;
  let end = 0;
  let sum = 0;

  // Find nearby rows with enough seats
  while (end < rowAvailability.length) {
    sum += rowAvailability[end];

    while (sum >= numOfSeats) {
      let length = end - start + 1;
      if (length < minLength) {
        minLength = length;
        minStart = start;
        minEnd = end;
      }
      sum -= rowAvailability[start];
      start++;
    }
    end++;
  }

  // If no nearby rows can fulfill the request
  if (minStart === -1 || minEnd === -1) {
    return { status: 500, message: 'Booking failed' };
  }

  // Get the seats from nearby rows
  let finalSeats = [];
  for (let row = minStart + 1; row <= minEnd + 1; row++) {
    const rowSeats = availableSeats.rows.filter(seat => seat.row_number === row);
    finalSeats = [...finalSeats, ...rowSeats.filter(seat => !seat.is_reserved)];
  }

  finalSeats = finalSeats.slice(0, numOfSeats);

  // Update the seats to reserved status
  for (let i = 0; i < finalSeats.length; i++) {
    const seat = finalSeats[i];
    await pool.query("UPDATE seats SET is_reserved = TRUE WHERE id = $1", [seat.id]);
  }

  return { status: 200, data: finalSeats };
};

// Function to get all seats
const getAllSeats = async () => {
  const result = await pool.query(
    "SELECT * FROM seats ORDER BY row_number, seat_number"
  );
  return result.rows;
};

// Function to reset seats
const resetSeats = async () => {
  await pool.query("UPDATE seats SET is_reserved = FALSE");
};

module.exports = {
  bookSeats,
  getAllSeats,
  resetSeats,
};