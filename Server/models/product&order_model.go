package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Category struct {
	ID            bson.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	Name          string        `json:"category" bson:"category" validate:"required"`
	SubCategories []string      `json:"sub_categories" bson:"sub_categories"`
}
type Cart struct {
	ID       bson.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	UserID   bson.ObjectID `json:"user_id" bson:"user_id" validate:"required"`
	Items    []OrderItem   `json:"items" bson:"items" validate:"required,dive"`
	Subtotal float64       `json:"subtotal" bson:"subtotal"`
}
type Product struct {
	ID          bson.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	Brand       string        `json:"Brand" bson:"brand" validate:"required"`
	Name        string        `json:"Product" bson:"product" validate:"required,min=2"`
	Quantity    string        `json:"Quantity" bson:"quantity" validate:"required"`
	Price       float64       `json:"Price" bson:"price" validate:"required,gt=0"`
	MRP         float64       `json:"MRP" bson:"mrp" validate:"required,gtefield=Price"`
	Category    string        `json:"Category,omitempty" bson:"category_name,omitempty"`
	SubCategory string        `json:"Sub-Category,omitempty" bson:"sub_category_name,omitempty"`
	ImageURL    string        `json:"image_small" bson:"image_small" validate:"required,url"`
	Stock       int           `json:"stock" bson:"stock"`
}
type OrderItem struct {
	ProductID  bson.ObjectID `json:"product_id" bson:"product_id" validate:"required"`
	Quantity   int           `json:"quantity" bson:"quantity" validate:"required,gt=0"`
	UnitPrice  float64       `json:"unit_price" bson:"unit_price" validate:"required,gt=0"`
	PriceAtAdd float64       `json:"price_at_add" bson:"price_at_add"`
	Subtotal   float64       `json:"subtotal" bson:"subtotal" validate:"required,gt=0"`
}
type Order struct {
	ID               bson.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	OrderID          string        `json:"order_id" bson:"order_id"`
	UserID           bson.ObjectID `json:"user_id" bson:"user_id" validate:"required"`
	Status           string        `json:"status" bson:"status" validate:"required,oneof=PENDING PACKING DISPATCHED DELIVERED CANCELLED"`
	Items            []OrderItem   `json:"items" bson:"items" validate:"required,dive"` // Embedded array of items
	ItemTotal        float64       `json:"item_total" bson:"item_total" validate:"required,min=0"`
	DeliveryFee      float64       `json:"delivery_fee" bson:"delivery_fee" validate:"min=0"`
	GrandTotal       float64       `json:"grand_total" bson:"grand_total" validate:"required,min=0"`
	DeliveryLocation Address       `json:"delivery_location" bson:"delivery_location" validate:"required"` // Embedded snapshot
	CreatedAt        time.Time     `json:"created_at" bson:"created_at"`
	UpdatedAt        time.Time     `json:"update_at" bson:"update_at"`
}
