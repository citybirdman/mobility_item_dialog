{% include 'mobility_advanced_item_dialog/custom/common_popup.js' %}
frappe.ui.form.on('Sales Order', {
	refresh: function(frm){
		if (frm.doc.docstatus == 1) {
			frm.set_df_property('get_items','hidden',1)
		}
	},
	onload_post_render(frm){
		if(frm.doc.__unsaved==1){
			if(frm.doc.items.length > 0 && !frm.doc.items[0].item_code) {
				frm.clear_table("items");
				frm.refresh_field('items')
			}
		}
	},
	get_items:function(frm) {
		let display_columns = {
			"Item Code":'',
			"Brand":'',
			"Item Name":'',
			"Actual Stock":"",
			"Available Stock": "",
			"Selling Price":'',
		}
		if(frappe.user_roles.includes("Chief Sales Officer")){
			
			display_columns["Valuation Rate"]= "";
		}

		var dialog = new frappe.ui.form.AereleSelectDialog({
				doctype: "Sales Order",
				target: frm,
				setters: [],
				display_columns,
				custom_method: 'mobility_advanced_item_dialog.custom.common_popup.get_item_details',
			})
		}
	}
);
