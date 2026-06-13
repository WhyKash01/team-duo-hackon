package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// JSONResponse defines the standard payload structure for all API endpoints.
type JSONResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// Address represents a delivery location with coordinates for Q-commerce routing.
type Address struct {
	AddressID   bson.ObjectID `json:"address_id,omitempty" bson:"address_id,omitempty"`
	Type        string        `json:"type" bson:"type" validate:"required,oneof=HOME WORK OTHER"`
	AddressLine string        `json:"address_line" bson:"address_line" validate:"required"`
	City        string        `json:"city" bson:"city" validate:"required"`
	State       string        `json:"state" bson:"state" validate:"required"`
	ZipCode     string        `json:"zip_code" bson:"zip_code" validate:"required"`
	Latitude    float64       `json:"latitude" bson:"latitude" validate:"required"`   // Critical for Q-commerce routing
	Longitude   float64       `json:"longitude" bson:"longitude" validate:"required"`  // Critical for Q-commerce routing
	IsDefault   bool          `json:"is_default" bson:"is_default"`
}

// User defines the registration profile and credentials.
type User struct {
	ID           bson.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	UserID       string        `json:"user_id" bson:"user_id"`
	FirstName    string        `json:"first_name" bson:"first_name" validate:"required,min=2,max=100"`
	LastName     string        `json:"last_name" bson:"last_name" validate:"required,min=2,max=100"`
	Email        string        `json:"email" bson:"email" validate:"required,email"`
	PhoneNumber  string        `json:"phone_number" bson:"phone_number" validate:"required,min=10,max=15"`
	Password     string        `json:"password" bson:"password" validate:"required,min=6"`
	Role         string        `json:"role" bson:"role" validate:"oneof=ADMIN USER RIDER"`
	IsActive     bool          `json:"is_active" bson:"is_active"`
	Addresses    []Address     `json:"addresses" bson:"addresses" validate:"dive"`
	CreatedAt    time.Time     `json:"created_at" bson:"created_at"`
	UpdatedAt    time.Time     `json:"update_at" bson:"update_at"`
	Token        string        `json:"token" bson:"token"`
	RefreshToken string        `json:"refresh_token" bson:"refresh_token"`
}

// UserLogin defines credentials submitted during authentication.
type UserLogin struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
}

// UserResponse defines the user profile returned after authentication.
type UserResponse struct {
	UserId       string    `json:"user_id"`
	FirstName    string    `json:"first_name"`
	LastName     string    `json:"last_name"`
	Email        string    `json:"email"`
	Role         string    `json:"role"`
	Token        string    `json:"token"`
	RefreshToken string    `json:"refresh_token"`
	Addresses    []Address `json:"addresses,omitempty"`
}
