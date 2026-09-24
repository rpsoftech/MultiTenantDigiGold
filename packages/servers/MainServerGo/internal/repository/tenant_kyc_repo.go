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
	stmtGetByTenant  *sql.Stmt
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

		querySelectByTenant := fmt.Sprintf(`
			SELECT %s, %s, %s, %s, %s, %s, %s, %s, %s
			FROM %s WHERE %s = $1 ORDER BY %s DESC
		`, schema.ColTKDID, schema.ColTKDUUID, schema.ColTKDTenantID, schema.ColTKDDocumentType,
			schema.ColTKDDocumentURL, schema.ColTKDStatus, schema.ColTKDVerifiedBy,
			schema.ColTKDCreatedAt, schema.ColTKDModifiedAt,
			schema.TableTenantKYCDocuments, schema.ColTKDTenantID, schema.ColTKDCreatedAt)

		stmtGetByTenant, err := db.Db.Prepare(querySelectByTenant)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Failed to prepare GetByTenant: %v", err))
		}

		tenantKYCRepoInstance = &TenantKYCRepository{
			DB:               db,
			stmtCreateKYCDoc: stmtCreate,
			stmtVerifyKYCDoc: stmtVerify,
			stmtGetByTenant:  stmtGetByTenant,
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

func (r *TenantKYCRepository) GetKYCDocsByTenantID(ctx context.Context, tenantID int64) ([]*models.TenantKYCDocument, error) {
	rows, err := r.stmtGetByTenant.QueryContext(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []*models.TenantKYCDocument
	for rows.Next() {
		var doc models.TenantKYCDocument
		var verifiedBy sql.NullString
		if err := rows.Scan(
			&doc.ID, &doc.UUID, &doc.TenantID, &doc.DocumentType,
			&doc.DocumentURL, &doc.Status, &verifiedBy,
			&doc.CreatedAt, &doc.ModifiedAt,
		); err != nil {
			return nil, err
		}
		if verifiedBy.Valid {
			doc.VerifiedBy = verifiedBy.String
		}
		docs = append(docs, &doc)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return docs, nil
}
