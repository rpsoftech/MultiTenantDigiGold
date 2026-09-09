package repository

import (
	"context"
	"database/sql"
	"fmt"
	"sync"

	"github.com/rpsoftech/DigiGold/MainServerGo/internal/models"
	"github.com/rpsoftech/DigiGold/MainServerGo/internal/schema"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/postgres"
)

type TenantKYCRepository struct {
	DB               *postgres.PostgresDBStruct
	stmtCreateKYCDoc *sql.Stmt
	stmtVerifyKYCDoc *sql.Stmt
}

var (
	tenantKYCRepoInstance *TenantKYCRepository
	tenantKYCRepoOnce     sync.Once
)

func GetTenantKYCRepository() *TenantKYCRepository {
	tenantKYCRepoOnce.Do(func() {
		db := postgres.GetPostgresDB()

		queryInsert := fmt.Sprintf(`
			INSERT INTO %s (%s, %s, %s, %s, %s)
			VALUES ($1, $2, $3, $4, $5) RETURNING %s, %s, %s
		`, schema.TableTenantKYCDocuments, schema.ColTKDUUID, schema.ColTKDTenantID,
			schema.ColTKDDocumentType, schema.ColTKDDocumentURL, schema.ColTKDStatus,
			schema.ColTKDID, schema.ColTKDCreatedAt, schema.ColTKDModifiedAt)

		stmtCreate, err := db.Db.Prepare(queryInsert)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare CreateKYCDoc: %v", err))
		}

		queryUpdate := fmt.Sprintf(`
			UPDATE %s SET %s = $1, %s = $2 WHERE %s = $3 AND %s = $4 RETURNING %s
		`, schema.TableTenantKYCDocuments, schema.ColTKDStatus, schema.ColTKDVerifiedBy,
			schema.ColTKDTenantID, schema.ColTKDUUID, schema.ColTKDModifiedAt)

		stmtVerify, err := db.Db.Prepare(queryUpdate)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare VerifyKYCDoc: %v", err))
		}

		tenantKYCRepoInstance = &TenantKYCRepository{
			DB:               db,
			stmtCreateKYCDoc: stmtCreate,
			stmtVerifyKYCDoc: stmtVerify,
		}
	})
	return tenantKYCRepoInstance
}

func (r *TenantKYCRepository) CreateKYCDocWithTx(ctx context.Context, tx *sql.Tx, doc *models.TenantKYCDocument) error {
	err := tx.StmtContext(ctx, r.stmtCreateKYCDoc).QueryRowContext(ctx,
		doc.UUID, doc.TenantID, doc.DocumentType, doc.DocumentURL, doc.Status,
	).Scan(&doc.ID, &doc.CreatedAt, &doc.ModifiedAt)

	if err != nil {
		return err
	}
	return nil
}

func (r *TenantKYCRepository) VerifyKYCDocWithTx(ctx context.Context, tx *sql.Tx, doc *models.TenantKYCDocument) error {
	err := tx.StmtContext(ctx, r.stmtVerifyKYCDoc).QueryRowContext(ctx,
		doc.Status, doc.VerifiedBy, doc.TenantID, doc.UUID,
	).Scan(&doc.ModifiedAt)

	if err != nil {
		return err
	}
	return nil
}
