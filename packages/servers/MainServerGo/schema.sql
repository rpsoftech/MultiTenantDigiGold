CREATE SCHEMA `DigiGold_test`;

USE `DigiGold_test`;

CREATE TABLE
    `Users` (
        `user_id` INT NOT NULL,
        `user_unique_id` VARCHAR(36) NOT NULL,
        `user_number` VARCHAR(13) NOT NULL,
        `user_first_name` VARCHAR(45) NULL,
        `user_last_name` VARCHAR(45) NULL,
        `user_full_name` VARCHAR(100) NULL,
        `user_date_of_birth` DATE NULL,
        `user_active` TINYINT NULL DEFAULT 0,
        `user_kyc_verified` TINYINT NULL DEFAULT 0,
        `user_kyc_verified_on` DATETIME NULL DEFAULT NULL,
        `user_kyc_details` JSON NULL,
        `user_modified_on` DATETIME NOT NULL,
        `user_created_on` DATETIME NOT NULL,
        PRIMARY KEY (`user_id`),
        UNIQUE INDEX `user_unique_id_UNIQUE` (`user_unique_id` ASC) VISIBLE,
        UNIQUE INDEX `user_number_UNIQUE` (`user_number` ASC) VISIBLE,
        INDEX `Users_index4` (`user_full_name` ASC) VISIBLE,
        INDEX `Users_index5` (`user_date_of_birth` ASC) VISIBLE,
        INDEX `Users_i6` (`user_kyc_verified` ASC, `user_active` ASC) VISIBLE,
        INDEX `Users_i7` (`user_modified_on` ASC) VISIBLE,
        INDEX `Users_i8` (`user_created_on` ASC) VISIBLE
    );