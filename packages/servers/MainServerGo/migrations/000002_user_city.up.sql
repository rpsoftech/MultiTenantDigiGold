-- City entered at registration (/auth/register `location`). Nullable: customers who
-- registered before this column existed have none.
ALTER TABLE users ADD COLUMN user_city VARCHAR(100);
