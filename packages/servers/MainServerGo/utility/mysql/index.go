package mysqldb

import (
	"database/sql"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/env"

	_ "github.com/go-sql-driver/mysql"
)

type MysqldbConfig struct {
	MYSQL_HOST     string `json:"MYSQL_HOST" validate:"required"`
	MYSQL_PORT     int    `json:"MYSQL_PORT" validate:"required"`
	MYSQL_USERNAME string `json:"MYSQL_USERNAME" validate:"required"`
	MYSQL_PASSWORD string `json:"MYSQL_PASSWORD" validate:"required"`
	MYSQL_DATABASE string `json:"MYSQL_DATABASE" validate:"required"`
}

type MysqlDBStruct struct {
	Db *sql.DB
}

// var token = ""
var MysqlDbCon *MysqlDBStruct

func (c *MysqlDBStruct) DeferFunction() {
	if err := c.Db.Close(); err != nil {
		panic(err)
	}
	log.Println("Mysqldb Defering...")
}
func GetMysqlDB() *MysqlDBStruct {
	if MysqlDbCon == nil {
		initaliseMysqlDb()
		return MysqlDbCon
	}
	return MysqlDbCon
}
func initaliseMysqlDb() {
	log.Println("MysqlDb Initalizing...")
	PORT, err := strconv.Atoi(env.Env.GetEnv(env.MYSQL_PORT_KEY))
	if err != nil {
		panic("Please Pass Valid Port")
	}
	config := &MysqldbConfig{
		MYSQL_HOST:     env.Env.GetEnv(env.MYSQL_HOST_KEY),
		MYSQL_PORT:     PORT,
		MYSQL_USERNAME: env.Env.GetEnv(env.MYSQL_USERNAME_KEY),
		MYSQL_PASSWORD: env.Env.GetEnv(env.MYSQL_PASSWORD_KEY),
		MYSQL_DATABASE: env.Env.GetEnv(env.MYSQL_DATABASE_KEY),
	}
	if db, err := InitializeMysqlDbWithConfig(config); err != nil {
		panic(err)
	} else {
		MysqlDbCon = db
	}
}

func InitializeMysqlDbWithConfig(config *MysqldbConfig) (*MysqlDBStruct, error) {
	db, err := sql.Open("mysql", fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?tls=false&autocommit=true&parseTime=true", config.MYSQL_USERNAME, config.MYSQL_PASSWORD, config.MYSQL_HOST, config.MYSQL_PORT, config.MYSQL_DATABASE))
	if err != nil {
		return nil, err
	}

	db.SetConnMaxLifetime(time.Minute * 1)
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(10)

	return &MysqlDBStruct{Db: db}, nil
}
