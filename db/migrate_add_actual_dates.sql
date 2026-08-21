-- Migration: add actual_date_start and actual_date_end for HRD-set training dates
-- training_date_start/end remain as the dept head's target month (YYYY-MM-01)
-- actual_date_start/end are NULL until HRD explicitly sets them

ALTER TABLE trx_training_request
  ADD COLUMN actual_date_start DATE NULL DEFAULT NULL AFTER training_date_end,
  ADD COLUMN actual_date_end   DATE NULL DEFAULT NULL AFTER actual_date_start;
