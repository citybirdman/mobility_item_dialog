{% include 'mobility_advanced_item_dialog/custom/common_popup.js' %}
frappe.ui.form.on('Sales Order', {
	onload_post_render(frm){
		if(frm.doc.__unsaved==1){
		frm.clear_table("items");
		frm.refresh_field('items')
		}
	},
	get_items:function(frm) {
		var dialog = new frappe.ui.form.AereleSelectDialog({
				doctype: "Sales Order",
				target: frm,
				setters: [],
				display_columns: {"Item Code":'',"Item Name":'',"Brand":'', "Production Year":'',"Rate":'',"Qty":""},
				custom_method: 'mobility_advanced_item_dialog.custom.common_popup.get_item_details',
				

			})
		}
	}
);
