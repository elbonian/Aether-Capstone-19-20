import xlrd
import sqlite3
from sqlite3 import Error


def create_connection(db_file):
    """ create a database connection to a SQLite database """
    try:
        cxn = sqlite3.connect(db_file)
        cur = cxn.cursor()
        print(sqlite3.version)
        return cxn, cur
    except Error as e:
        print("Error! cannot create the database connection:")
        print(e)
        exit(-1)


def create_table(cxn, cur, create_table_sql):
    try:
        cur.execute(create_table_sql)
        cxn.commit()
    except Error as e:
        print(e)
        exit(-2)


def fill_tables(cxn, cur):

    book = xlrd.open_workbook("db_populate.xlsx")
    kernel = book.sheet_by_name("Kernel")
    body = book.sheet_by_name("Body")

    kernel_query = """INSERT OR REPLACE INTO Kernel VALUES (?, ?, ?, ?, ?)"""
    body_query = """INSERT OR REPLACE INTO Body VALUES (?, ?, ?, ?, ?)"""

    for r in range(1, kernel.nrows):
        path = kernel.cell(r, 0).value
        start_date = kernel.cell(r, 1).value
        end_date = kernel.cell(r, 2).value
        size = kernel.cell(r, 3).value
        user_id = kernel.cell(r, 4).value

        values = [path, start_date, end_date, size, user_id]

        cur.execute(kernel_query, values)

    for r in range(1, body.nrows):
        path = body.cell(r, 0).value
        name = body.cell(r, 1).value
        wrt = body.cell(r, 2).value
        naif_id = body.cell(r, 3).value
        tag = body.cell(r, 4).value

        values = [path, name, wrt, naif_id, tag]

        cur.execute(body_query, values)

    # commit the transaction
    cxn.commit()


def main():
    db_name = "aether_backend_data.db"

    sql_create_kernel_table = """CREATE TABLE IF NOT EXISTS Kernel (
                                        path text PRIMARY KEY,
                                        start_date text NOT NULL,
                                        end_date text NOT NULL,
                                        size integer NOT NULL,
                                        user_id integer
                                    );"""
    sql_create_body_table = """ CREATE TABLE IF NOT EXISTS Body (
                                    path text NOT NULL,
                                    name text NOT NULL,
                                    wrt text NOT NULL,
                                    naif_id integer,
                                    tag text,
                                    PRIMARY KEY (path, name, wrt)
                                );"""
    sql_create_user_table = """ CREATE TABLE IF NOT EXISTS User (
                                    user_id integer PRIMARY KEY
                                );"""

    cxn, cur = create_connection(db_name)

    create_table(cxn, cur, sql_create_kernel_table)
    create_table(cxn, cur, sql_create_body_table)
    create_table(cxn, cur, sql_create_user_table)

    fill_tables(cxn, cur)

    print("========Printing Kernel Table========")
    cur.execute('SELECT * FROM Kernel LIMIT 10')
    for row in cur:
        print(row)

    print("========Printing Body Table========")
    cur.execute('SELECT * FROM Body LIMIT 10')
    for row in cur:
        print(row)

    # Close the cursor
    cur.close()

    # Close the database connection
    cxn.close()


if __name__ == '__main__':
    main()
