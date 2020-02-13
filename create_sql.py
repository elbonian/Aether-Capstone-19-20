
import sqlite3
from sqlite3 import Error


def create_connection(db_file):
    """ create a database connection to a SQLite database """
    conn = None
    try:
        conn = sqlite3.connect(db_file)
        print(sqlite3.version)
        return conn
    except Error as e:
        print(e)
    return conn

def create_table(conn, create_table_sql):
    try:
        c = conn.cursor()
        c.execute(create_table_sql)
    except Error as e:
        print(e)

def main():
    database = "KernalsData.db"

    sql_create_kernel_table = """CREATE TABLE IF NOT EXISTS Kernel (
                                        path text PRIMARY KEY,
                                        start_date text NOT NULL,
                                        end_date text NOT NULL,
                                        size integer NOT NULL,
                                        user_id integer
                                    );"""
    sql_create_body_table = """ CREATE TABLE IF NOT EXISTS Body (
                                    path text PRIMARY KEY,
                                    name text NOT NULL,
                                    wrt text NOT NULL,
                                    naif_id integer,
                                    tag text
                                );"""
    sql_create_user_table = """ CREATE TABLE IF NOT EXISTS User (
                                    user_id integer PRIMARY KEY
                                );"""

    conn = create_connection(database)
    if conn is not None:

        create_table(conn, sql_create_kernel_table)
        create_table(conn, sql_create_body_table)
        create_table(conn, sql_create_user_table)
    else:
        print("Error! cannot create the database connection.")
if __name__ == '__main__':
    main()
