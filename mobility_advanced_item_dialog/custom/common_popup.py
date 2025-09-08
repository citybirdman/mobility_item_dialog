import frappe
from frappe.model.document import Document
from json import loads

@frappe.whitelist()
def get_item_details(filters=None):
    filters = loads(filters)

    if filters["warehouse"] == "":
        frappe.throw("Source Warehouse is not selected ")
    if filters["price_list"] == "" and filters["doc_type"] != "Stock Entry":
        frappe.throw("Price List is not selected")

    # Build query conditions safely
    conditions = ["disabled = 0"]
    params = []

    if filters.get("item_code"):
        conditions.append("name = %s")
        params.append(filters["item_code"])

    if filters.get("brand"):
        brand_list = filters["brand"]
        if isinstance(brand_list, str):
            brand_list = frappe.parse_json(brand_list)
        if brand_list:
            conditions.append("brand IN ({})".format(", ".join(["%s"] * len(brand_list))))
            params.extend(brand_list)

    if filters.get("country_of_origin"):
        conditions.append("country_of_origin = %s")
        params.append(filters["country_of_origin"])

    if filters.get("item_group"):
        conditions.append("item_group = %s")
        params.append(filters["item_group"])

    if filters.get("txt"):
        txt = f"%{filters['txt']}%"
        conditions.append("(name LIKE %s OR item_name LIKE %s)")
        params.extend([txt, txt])

    if not conditions:
        return {"values": []}

    result = frappe.db.sql("""
        SELECT
            item_code AS `Item Code`,
            item_name AS `Item Name`,
            brand AS Brand,
            has_batch_no AS `Has Batch No`
        FROM `tabItem`
        WHERE {}
        ORDER BY brand
    """.format(" AND ".join(conditions)), params, as_dict=True)

    result_value = []

    for item in result:
        item["Brand"] = item["Brand"] or ""

        # Get quantities per production year + Selling Price
        batch_values = get_qnt_on_warehouse(
            item["Item Code"],
            filters["warehouse"],
            filters["price_list"]
        )

        # Get Valuation Rate
        valuation_rate_data = frappe.db.sql("""
            SELECT
                CASE WHEN SUM(actual_qty) = 0 THEN 0
                ELSE ROUND(SUM(stock_value_difference) / SUM(actual_qty), 2)
                END AS valuation_rate
            FROM `tabStock Ledger Entry`
            WHERE
                is_cancelled = 0
                AND item_code = %s
                AND warehouse = %s
        """, (item["Item Code"], filters["warehouse"]), as_dict=True)

        val_rate = valuation_rate_data[0].valuation_rate if valuation_rate_data else 0

        # Get Reserved Quantity per production year
        reserved_qty_data = frappe.db.sql("""
            SELECT
                production_year,
                SUM(qty_to_deliver) AS reserved_qty
            FROM (
                SELECT
                    sales_order_item.production_year,
                    (sales_order_item.qty - sales_order_item.delivered_qty) AS qty_to_deliver
                FROM `tabSales Order Item` sales_order_item
                INNER JOIN `tabSales Order` sales_order
                    ON sales_order_item.parent = sales_order.name
                WHERE sales_order.docstatus = 1
                    AND sales_order_item.docstatus = 1
                    AND sales_order.status NOT IN ('Completed', 'Closed')
                    AND (sales_order_item.qty - sales_order_item.delivered_qty) > 0
                    AND sales_order_item.item_code = %s
                    AND sales_order.set_warehouse = %s
            ) sub
            GROUP BY production_year
        """, (item["Item Code"], filters["warehouse"]), as_dict=True)

        reserved_qty_map = {
            row.production_year: row.reserved_qty for row in reserved_qty_data or []
        }

        # Loop over batches
        for row in batch_values:
            production_year = row["production_year"]
            actual_qty = int(row["qty"] or 0)
            reserved_qty = reserved_qty_map.get(production_year, 0) or 0
            available_qty = actual_qty - reserved_qty

            if filters.get("exclude_zero_quantity", 0) == 0 or row["qty"] != '0':
                result_value.append({
                    "Item Code": item["Item Code"],
                    "Item Name": item["Item Name"],
                    "Brand": item["Brand"],
                    "Selling Price": row["rate"],
                    "Actual Stock": actual_qty,
                    "Available Stock": available_qty,
                    "Valuation Rate": val_rate,
                    "Production Year": production_year
                })

    return {"values": result_value}


def get_qnt_on_warehouse(item, warehouse, price_list):
    data = frappe.db.sql("""
        SELECT
            COALESCE(SUM(actual_qty), 0) AS qty,
            production_year
        FROM `tabStock Ledger Entry`
        WHERE
            item_code = %s
            AND warehouse = %s
            AND is_cancelled = 0
        GROUP BY production_year
    """, (item, warehouse), as_dict=True)

    result = []

    if not data:
        result.append({
            "qty": "0",
            "rate": frappe.db.get_value(
                "Item Price",
                {"item_code": item, "price_list": price_list},
                "price_list_rate"
            ) or 0,
            "production_year": ""
        })
    else:
        for row in data:
            # Fetch price for production year if applicable
            rate = frappe.db.get_value(
                "Item Price",
                {
                    "item_code": item,
                    "price_list": price_list,
                    "production_year": row.production_year
                },
                "price_list_rate"
            )
            if rate is None:
                # fallback
                rate = frappe.db.get_value(
                    "Item Price",
                    {"item_code": item, "price_list": price_list},
                    "price_list_rate"
                ) or 0

            result.append({
                "qty": str(int(row.qty or 0)),
                "rate": rate,
                "production_year": row.production_year or ""
            })

    return result
