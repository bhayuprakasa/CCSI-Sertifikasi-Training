-- Drop unused tables that were never implemented in the MySQL backend.
-- Safe to run multiple times (IF EXISTS guards).

DROP TABLE IF EXISTS trx_approval_step;
DROP TABLE IF EXISTS trx_approval_instance;
DROP TABLE IF EXISTS trx_employee_program;
DROP TABLE IF EXISTS mst_program;
