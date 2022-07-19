from unittest import result
import frappe
from frappe.model.document import Document
from json import loads
from erpnext.stock.doctype.batch.batch import get_batch_qty
@frappe.whitelist()
def get_item_details(filters=None):
    filters = loads(filters)
    if filters["warehouse"] == "":
        frappe.throw("Soures Warehouse is not selected ")
    if  filters["price_list"] == "":
        frappe.throw("Price List is not selected")
    if(filters["item_code"] or  filters["brand"]  or filters["txt"]):
        condition = ""
        if filters["item_code"]:
            condition += " and name = '{0}' ".format(filters["item_code"])
        if filters["brand"]:
            condition += " and brand = '{0}' ".format(filters["brand"])
        if filters["txt"]:
            condition += " and (name like '%{0}%' or item_name like '%{0}%') ".format(filters["txt"])
        result=frappe.db.sql("""Select item_code as 'Item Code', item_name as 'Item Name', brand as Brand ,has_batch_no as 'Has Batch No'
        from `tabItem` where has_batch_no= 1 {0}  and disabled= 0 """.format(condition),as_dict=True)
        result_value=[]
        length=len(result)
        for i in range(0,length):
            if(str(result[i]["Brand"])=='None'):
                result[i]["Brand"] = ""
            
            batch_values=get_qnt_on_batch_warehouse(str(result[i]["Item Code"]),filters["warehouse"],filters["price_list"])
            if(filters["exclude_zero_quantity"]==0):
                for j in range(len(batch_values)):
                    result_value.append({"Item Code":str(result[i]["Item Code"]),"Item Name":str(result[i]["Item Name"]),"Brand":str(result[i]["Brand"]),"Production Year":str(batch_values[j]["production_year"]),"Rate":batch_values[j]["rate"],"Qty":batch_values[j]["qty"],"Batch":str(batch_values[j]["batch_no"])})
            else:
                for j in range(len(batch_values)):
                    if(batch_values[j]["qty"]!='0'):
                        result_value.append({"Item Code":str(result[i]["Item Code"]),"Item Name":str(result[i]["Item Name"]),"Brand":str(result[i]["Brand"]),"Production Year":str(batch_values[j]["production_year"]),"Rate":batch_values[j]["rate"],"Qty":batch_values[j]["qty"],"Batch":str(batch_values[j]["batch_no"])})
        return {"values": result_value}
    return{"values":[]}

def get_qnt_on_batch_warehouse(item,warehouse,price_list):
    batch=[]
    all_batch=frappe.db.get_list("Batch",{"item":item,"disabled":0})
    for batchs in all_batch:
        qty=0
        batch_values = get_batch_qty(warehouse=warehouse,batch_no=batchs["name"])
        if batch_values:
            qty = batch_values
        production_year=str((frappe.db.get_value("Batch",{"name":batchs["name"],"item":item},"production_year")))
        if production_year == "None":
            production_year=" "
        batch.append({"production_year":production_year,
        

        "qty":str(qty),
        "rate":(frappe.db.get_value("Item Price",{"item_code":item,"price_list":price_list,"batch_no":batchs["name"]},"price_list_rate")),
        "batch_no":str(batchs["name"])
        })
    return batch