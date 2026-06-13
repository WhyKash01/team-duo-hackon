package models

import (
	"time"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type Product struct {
	ID         bson.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	ProductID  string        `json:"product_id" bson:"product_id"`
	SKU        string        `json:"sku" bson:"sku" validate:"required"`
	Name       string        `json:"name" bson:"name" validate:"required,min=2"`
	CategoryID bson.ObjectID `json:"category_id" bson:"category_id" validate:"required"`
	BasePrice  float64       `json:"base_price" bson:"base_price" validate:"required,gt=0"`
	ImageURL   string        `json:"image_url" bson:"image_url" validate:"required,url"`
	CreatedAt  time.Time     `json:"created_at" bson:"created_at"`
	UpdatedAt  time.Time     `json:"update_at" bson:"update_at"`
}

type OrderItem struct {
	ProductID bson.ObjectID `json:"product_id" bson:"product_id" validate:"required"`
	Quantity  int           `json:"quantity" bson:"quantity" validate:"required,gt=0"`
	UnitPrice float64       `json:"unit_price" bson:"unit_price" validate:"required,gt=0"`
	Subtotal  float64       `json:"subtotal" bson:"subtotal" validate:"required,gt=0"`
}

type Order struct {
	ID               bson.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	OrderID          string        `json:"order_id" bson:"order_id"`
	UserID           bson.ObjectID `json:"user_id" bson:"user_id" validate:"required"`
	StoreID          bson.ObjectID `json:"store_id" bson:"store_id" validate:"required"`
	Status           string        `json:"status" bson:"status" validate:"required,oneof=PENDING PACKING DISPATCHED DELIVERED CANCELLED"`
	Items            []OrderItem   `json:"items" bson:"items" validate:"required,dive"` // Embedded array of items
	ItemTotal        float64       `json:"item_total" bson:"item_total" validate:"required,min=0"`
	DeliveryFee      float64       `json:"delivery_fee" bson:"delivery_fee" validate:"min=0"`
	GrandTotal       float64       `json:"grand_total" bson:"grand_total" validate:"required,min=0"`
	DeliveryLocation Address       `json:"delivery_location" bson:"delivery_location" validate:"required"` // Embedded snapshot
	CreatedAt        time.Time     `json:"created_at" bson:"created_at"`
	UpdatedAt        time.Time     `json:"update_at" bson:"update_at"`
}
