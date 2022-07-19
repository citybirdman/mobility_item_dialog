{% include 'mobility_advanced_item_dialog/custom/common_pop_up.js' %}
frappe.ui.form.on('Sales Invoice', {
	onload_post_render(frm){
		if(frm.doc.__unsaved==1){
		frm.clear_table("items");
		frm.refresh_field('items')
		}
	},
	get_items:function(frm) {
		let data = {};
		
		var c = new frappe.ui.form.AereleSelectDialog({
				doctype: "Sales Invoice",
				target: frm,
				setters: [],
				display_columns: {"Item Code":'',"Item Name":'',"Brand":'', "Production Year":'',"Rate":'',"Qty":""},
				custom_method: 'mobility_advanced_item_dialog.custom.common_pop_up.get_item_details',

			})
			
		}
		
	}
	 
);
