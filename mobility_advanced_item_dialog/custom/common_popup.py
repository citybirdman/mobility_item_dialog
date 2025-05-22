from unittest import result
import frappe
from frappe.model.document import Document
from json import loads
from erpnext.stock.doctype.batch.batch import get_batch_qty
@frappe.whitelist()
def get_item_details(filters=None):
    filters = loads(filters)
    if filters["warehouse"] == "":
        frappe.throw("Source Warehouse is not selected ")
    if  filters["price_list"] == "" and filters["doc_type"] != "Stock Entry":
        frappe.throw("Price List is not selected")
    if(filters["item_code"] or  filters["brand"]  or filters["txt"] or filters["country_of_origin"] or filters["item_group"]):
        condition = ""
        if filters["item_code"]:
            condition += " and name = '{0}' ".format(filters["item_code"])
        if len(frappe.parse_json(filters["brand"])):
            condition += " and brand in ({0}) ".format(", ".join(f"'{item}'" for item in frappe.parse_json(filters["brand"]))) #["brand_1"]
            

        if filters["country_of_origin"]:
            condition += " and country_of_origin = '{0}' ".format(filters["country_of_origin"])
        if filters["item_group"]:
            condition += " and item_group = '{0}' ".format(filters["item_group"])
        if filters["txt"]:
            condition += " and (name like '%{0}%' or item_name like '%{0}%') ".format(filters["txt"])
        result=frappe.db.sql("""
                        Select
                            item_code as 'Item Code',
                            item_name as 'Item Name',
                            brand as Brand ,
                            has_batch_no as 'Has Batch No'
                             
                        from `tabItem`
                        where
                            disabled=0 {0}
                        ORDER BY brand     
                    """.format(condition),as_dict=True)
        result_value=[]
        length=len(result)
        for i in range(0,length):
            if(str(result[i]["Brand"])=='None'):
                result[i]["Brand"] = ""

            batch_values=get_qnt_on_warehouse(str(result[i]["Item Code"]),filters["warehouse"],filters["price_list"])
            vr = frappe.db.sql(f"""
                SELECT
                    COALESCE(ROUND(SUM(stock_value_difference) / SUM(actual_qty), 2), 0) AS valuation_rate
                FROM
                    `tabStock Ledger Entry`
                WHERE
                    is_cancelled = 0
                AND
                    item_code = "{result[i]["Item Code"]}"
                AND
                    warehouse = "{filters["warehouse"]}"
            """, as_dict=True)

            actual_available_qty = frappe.db.sql(f"""
			SELECT
                COALESCE(IF(sales_future.future_qty_to_deliver > purchase_future.future_balance, stock_actual.actual_balance - (sales_actual.actual_qty_to_deliver + (sales_future.future_qty_to_deliver - purchase_future.future_balance)), stock_actual.actual_balance-sales_actual.actual_qty_to_deliver), 0) AS actual_available_qty
            FROM
                (
                SELECT
                    COALESCE(SUM(actual_qty), 0) AS actual_balance
                FROM
                    `tabStock Ledger Entry`
                WHERE
                    is_cancelled = 0
                AND
                    item_code = "{result[i]["Item Code"]}"
                AND
                    warehouse="{filters["warehouse"]}"
                ) stock_actual
            LEFT JOIN
                (
                SELECT
                    COALESCE(SUM(purchase_receipt_item.qty), 0) AS future_balance
                FROM
                    `tabPurchase Receipt Item` purchase_receipt_item
                INNER JOIN
                    `tabPurchase Receipt` purchase_receipt
                ON
                    purchase_receipt_item.parent = purchase_receipt.name
                WHERE
                    purchase_receipt_item.docstatus = 0
                AND
                    purchase_receipt.docstatus = 0
                AND
                    purchase_receipt.virtual_receipt = 1
                AND
                    purchase_receipt_item.item_code = "{result[i]["Item Code"]}"
                AND
                    purchase_receipt_item.warehouse = "{filters["warehouse"]}"
                ) purchase_future
            ON
                TRUE
            LEFT JOIN
                (
                SELECT
                    COALESCE(SUM(qty_to_deliver), 0) AS actual_qty_to_deliver
                FROM
                    (
                    SELECT
                        sales_order.name AS sales_order,
                        sales_order.set_warehouse,
                        sales_order_item.item_code,
                        IF(COALESCE(SUM(sales_order_item.qty - sales_order_item.delivered_qty), 0) > 0, COALESCE(SUM(sales_order_item.qty - sales_order_item.delivered_qty), 0), 0) AS qty_to_deliver
                    FROM
                        `tabSales Order Item` sales_order_item
                    INNER JOIN
                        `tabSales Order` sales_order
                    ON
                        sales_order_item.parent = sales_order.name
                    INNER JOIN
                        `tabItem` item
                    ON
                        sales_order_item.item_code = item.name
                    WHERE
                        sales_order.docstatus = 1
                    AND
                        sales_order_item.docstatus = 1
                    AND
                        sales_order.status NOT IN ('Completed', 'Closed')
                    AND
                        sales_order.reservation_status NOT IN ('Reserve against Future Receipts')
                    AND
                        sales_order_item.qty - sales_order_item.delivered_qty > 0
                    AND
                        item.is_stock_item = 1
                    GROUP BY
                        sales_order.name,
                        sales_order.set_warehouse,
                        sales_order_item.item_code
                    ) sales_order_item
                WHERE
                    item_code = "{result[i]["Item Code"]}"
                AND
                    set_warehouse = "{filters["warehouse"]}"
                ) sales_actual
            ON
                TRUE
            LEFT JOIN
                (
                SELECT
                    COALESCE(SUM(qty_to_deliver), 0) AS future_qty_to_deliver
                FROM
                    (
                    SELECT
                        sales_order.name AS sales_order,
                        sales_order.set_warehouse,
                        sales_order_item.item_code,
                        IF(COALESCE(SUM(sales_order_item.qty - sales_order_item.delivered_qty), 0) > 0, COALESCE(SUM(sales_order_item.qty - sales_order_item.delivered_qty), 0), 0) AS qty_to_deliver
                    FROM
                        `tabSales Order Item` sales_order_item
                    INNER JOIN
                        `tabSales Order` sales_order
                    ON
                        sales_order_item.parent = sales_order.name
                    INNER JOIN
                        `tabItem` item
                    ON
                        sales_order_item.item_code = item.name
                    WHERE
                        sales_order.docstatus = 1
                    AND
                        sales_order_item.docstatus = 1
                    AND
                        sales_order.status NOT IN ('Completed', 'Closed')
                    AND
                        sales_order.reservation_status IN ('Reserve against Future Receipts')
                    AND
                        sales_order_item.qty - sales_order_item.delivered_qty > 0
                    AND
                        item.is_stock_item = 1
                    GROUP BY
                        sales_order.name,
                        sales_order.set_warehouse,
                        sales_order_item.item_code
                    ) sales_order_item
                WHERE
                    item_code = "{result[i]["Item Code"]}"
                AND
                    set_warehouse = "{filters["warehouse"]}"
                ) sales_future
            ON
                TRUE 
            """, as_dict=True)
            if not actual_available_qty:
                actual_available_qty = 0
            if(filters["exclude_zero_quantity"]==0):
                for j in range(len(batch_values)):
                    result_value.append(
                        {
                            "Item Code":str(result[i]["Item Code"]),
                            "Item Name":str(result[i]["Item Name"]),
                            "Brand":str(result[i]["Brand"]),
                            "Selling Price":batch_values[j]["rate"],
                            "Actual Stock":batch_values[j]["qty"],
                            "Available Stock": actual_available_qty[0].actual_available_qty or 0,
                            "Valuation Rate": vr[0].valuation_rate
                        }
                    )
            else:
                for j in range(len(batch_values)): 
                    if(batch_values[j]["qty"]!='0'):
                        result_value.append(
                            {
                                "Item Code":str(result[i]["Item Code"]),
                                "Item Name":str(result[i]["Item Name"]),
                                "Brand":str(result[i]["Brand"]),
                                "Selling Price":batch_values[j]["rate"],
                                "Actual Stock":batch_values[j]["qty"],
                                "Available Stock": actual_available_qty[0].actual_available_qty or 0,
                                "Valuation Rate": vr[0].valuation_rate
                            }
                        )
        return {"values": result_value}
    return{"values":[]}

def get_qnt_on_warehouse(item,warehouse,price_list):
    batch=[]
    qty = frappe.db.get_value('Bin', {'item_code': item,'warehouse': warehouse}, 'actual_qty')
    if not qty:
        qty = 0
    batch.append({
    "qty":str(int(qty)),
    "rate":(frappe.db.get_value("Item Price",{"item_code":item,"price_list":price_list},"price_list_rate")),
    })
    return batch
    
