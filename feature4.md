Use RabbitMQ events (view/purchase/consume) to update Redis per user-item stats: count, first_used, last_used.
Compute avg_interval = (last_used - first_used) / max(count-1,1) and gap = now - last_used.
Score = gap / avg_interval; add weighted_global_score = 0.6 * score + 0.4 * log(count). If ≥ 1.2 suggest item, ≥ 2.0 strongly recommend.
This creates a simple rule-based replenishment system (no ML) for recurring needs like milk/groceries.