{% include 'mobility_advanced_item_dialog/custom/common_popup.js' %}
frappe.ui.form.on('Stock Entry', {
	refresh: function(frm){
		if (frm.doc.docstatus == 1) {
			frm.set_df_property('custom_get_items0','hidden',1)
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
	custom_get_items0:function(frm) {
		var dialog = new frappe.ui.form.AereleSelectDialog({
				doctype: "Stock Entry",
				target: frm,
				setters: [],
				display_columns: {
						"Item Code":'',
                        "Brand":'',
                        "Item Name":'',
                        "Actual Stock":"",
                        "Available Stock": ""
					},
				custom_method: 'mobility_advanced_item_dialog.custom.common_popup.get_item_details',
			})
		}
	}
);

