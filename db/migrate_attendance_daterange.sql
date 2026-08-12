USE ccsi_training;

-- Add date range columns to main table
ALTER TABLE trx_training_attendance
  ADD COLUMN training_date_start DATE NULL AFTER department,
  ADD COLUMN training_date_end   DATE NULL AFTER training_date_start;

-- Migrate existing dates: earliest → start, latest → end
UPDATE trx_training_attendance a
JOIN (
  SELECT attendance_id, MIN(training_date) AS d_start, MAX(training_date) AS d_end
  FROM trx_training_attendance_date
  GROUP BY attendance_id
) d ON a.attendance_id = d.attendance_id
SET a.training_date_start = d.d_start,
    a.training_date_end   = d.d_end;

-- Drop old date child table
DROP TABLE IF EXISTS trx_training_attendance_date;
