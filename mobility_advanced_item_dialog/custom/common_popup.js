frappe.ui.form.AereleSelectDialog = class AereleSelectDialog {
	constructor(opts) {
		Object.assign(this, opts);
		this.results = []; // Initialize results array to prevent undefined errors
		this.dialogOpen = false; // Flag to prevent multiple dialogs
		var me = this;
		if (this.doctype != "[Select]") {
			frappe.model.with_doctype(this.doctype, function () {
				me.make();
			});
		} else {
			this.make();
		}
	}

	make() {
		let me = this;
		this.page_length = 20;
		this.start = 0;
		let fields = this.get_primary_filters();
		fields = fields.concat([
			{
				fieldtype: "Button",
				fieldname: "more_btn",
				label: __("Search"),
				click: () => {
					this.start += 20;
					this.get_results();
				},
				hidden: 1
			},
			{ fieldtype: "HTML", fieldname: "results_area" }
		]);
		if (this.data_fields) {
			fields = fields.concat(this.data_fields);
		}
		let doctype_plural = this.doctype;
		this.dialog = new frappe.ui.Dialog({
			title: 'Get Items',
			fields: fields,
		});
		// console.log(this.dialog)
		this.dialog = new frappe.ui.Dialog({
			title: __("Select {0}", ["Items"]),
			fields: fields,
		});
		this.dialog.$wrapper.find('.modal-dialog').removeClass("modal-lg").addClass("modal-xl");
		if (this.add_filters_group) {
			this.make_filter_area();
		}
		this.$parent = $(this.dialog.body);
		this.$wrapper = this.dialog.fields_dict.results_area.$wrapper.append(`<div class="results"
			style="border: 1px solid #d1d8dd; border-radius: 3px; height: 300px; overflow: auto;"></div>`);
		this.$results = this.$wrapper.find('.results');
		this.$results.append(this.make_list_row());
		this.args = {};
		this.bind_events();
		// this.get_results();
		this.dialog.show();
		
		// Ensure event delegation is properly set up after dialog is shown
		setTimeout(() => {
			this.setup_row_click_events();
		}, 100);
		
		// Global handler removed - using only direct handlers to prevent duplicates
	}

	get_primary_filters() {
		let fields = [];
		let columns = new Array(3);
		columns[0] = [
			{
				fieldtype: "Data",
				label: __("Item Search Bar"),
				fieldname: "txt",
				change: () => {
					this.start += 20;
					this.get_results();
				}
			},
			{
				fieldname: "column_break_3",
				fieldtype: "Column Break"
			},
			{
				fieldtype: "Link",
				label: __("Item Code"),
				fieldname: "item_code",
				options: "Item",
				change: () => {
					this.start += 20;
					this.get_results();
				}
			},
			{
				fieldname: "column_break_1",
				fieldtype: "Column Break"
			},
			{
				fieldtype: "MultiSelectList",
				label: __("Brand"),
				fieldname: "brand",
				options: "Brand",
				get_data: function (txt) {
					return frappe.db.get_link_options("Brand", txt);
				},
				change: () => {
					this.start += 20;
					this.get_results();
				}
			},
			{
				fieldname: "column_break_4",
				fieldtype: "Column Break"
			},
			{
				fieldtype: "Link",
				label: __("Item Group"),
				fieldname: "item_group",
				options: "Item Group",
				change: () => {
					this.start += 20;
					this.get_results();
				}
			},
			{
				fieldname: "column_break_5",
				fieldtype: "Column Break"
			},
			{
				fieldtype: "Link",
				label: __("Country Of Origin"),
				fieldname: "country_of_origin",
				options: "Country",
				change: () => {
					this.start += 20;
					this.get_results();
				}
			},
			{
				fieldname: "section_break_1",
				fieldtype: "Section Break"
			},
			{
				fieldtype: "Check",
				label: __("Exclude Zero Quantity"),
				fieldname: "exclude_zero_quantity",
				default: 1,
				change: () => {
					this.start += 20;
					this.get_results();
				}
			},
		];
		fields = [
			...columns[0],
		];
		if (this.add_filters_group) {
			fields.push(
				{
					fieldtype: 'HTML',
					fieldname: 'filter_area',
				}
			);
		}
		return fields;
	}

	make_filter_area() {
		this.filter_group = new frappe.ui.FilterGroup({
			parent: this.dialog.get_field('filter_area').$wrapper,
			doctype: this.doctype,
			on_change: () => {
				this.get_results();
			}
		});
	}

	get_custom_filters() {
		if (this.add_filters_group && this.filter_group) {
			return this.filter_group.get_filters().reduce((acc, filter) => {
				return Object.assign(acc, {
					[filter[1]]: [filter[2], filter[3]]
				});
			}, {});
		} else {
			return [];
		}
	}

	bind_events() {
		let me = this;
		// frappe.ui.keys.on('enter',function(e)
		// {
		// 	me.get_results();
		// }

		// );
		// Basic event handlers for checkboxes and other elements
		this.$results.on('click', '.list-item--head :checkbox', (e) => {
			this.$results.find('.list-item-container .list-row-check')
				.prop("checked", ($(e.target).is(':checked')));
		});
		this.$parent.find('.input-with-feedback').on('change', () => {
			frappe.flags.auto_scroll = false;
		});
		this.$parent.find('[data-fieldtype="Data"]').on('input', () => {
			var $this = $(this);
			clearTimeout($this.data('timeout'));
			$this.data('timeout', setTimeout(function () {
				frappe.flags.auto_scroll = false;
				me.empty_list();
			}, 300));
		});

	}

	open_quantity_dialog(data) {
		// Prevent multiple dialogs from opening
		if (this.dialogOpen) {
			console.log('Dialog already open, ignoring duplicate request');
			return;
		}
		
		this.dialogOpen = true;
		console.log('Opening quantity dialog for:', data.item_code);
		
		frappe.prompt([
		{
			label: 'Item Code',
			fieldname: 'item_code',
			fieldtype: 'Data',
			default:data.item_code,
			read_only:1
		},
		{
			label: 'Item Name',
			fieldname: 'item_name',
			fieldtype: 'Data',
			default:data.item_name,
			read_only:1
		},
		{
			label: 'Quantity',
			fieldname: 'qty',
			fieldtype: 'Int',
		},
		], (values) => {
			// Reset flag when dialog closes
			this.dialogOpen = false;
			
			if(cur_frm.doctype === "Sales Order") {
				// check if item already exists in items table
				let exists = (cur_frm.doc.items || []).some(row => row.item_code === data.item_code);
				if (exists) {
					frappe.msgprint({
						title: __('Duplicate Item'),
						message: __('Item {0} is already added in the table.', [data.item_code]),
						indicator: 'red'
					});
					return;
				}
			}
			if(cur_frm.doc.docstatus == 0){
				let rows = cur_frm.add_child("items")
				frappe.model.set_value(rows.doctype, rows.name, "item_code", data.item_code.toString());

				if(values.qty){
					frappe.model.set_value(rows.doctype, rows.name, "qty", values.qty);
					frappe.model.set_value(rows.doctype, rows.name, "batch", data.batch.toString());
					frappe.model.set_value(rows.doctype, rows.name, "rate", data.rate);
				}
			}else if(cur_frm.doc.docstatus == 1){
				if(values.qty){
					(async ()=>{
						let items_table = this.cur_dialog.get_field("trans_items")
						items_table.grid.add_new_row();
						let row = items_table.grid.get_data().slice(-1)[0]
						row.item_code = data.item_code.toString();
						let b = await frappe.db.get_value('Item', { 'item_code': data.item_code.toString() }, 'item_name')
						if(b.message){
							row.item_name = b.message.item_name
						}
						row.qty = values.qty;
						row.rate = data.rate;
						row.brand = data.brand;
						items_table.grid.refresh()
					})()
				}
			}
		});
	}

	setup_row_click_events() {
		console.log('Event delegation setup - direct handlers are used instead');
		console.log('Number of list-item-container elements:', this.$results.find('.list-item-container').length);
	}

	get_checked_values() {
		return this.$results.find('.list-item-container').map(function () {
			if ($(this).find('.list-row-check:checkbox:checked').length > 0) {
				return $(this).attr('data-item-name');
			}
		}).get();
	}

	get_checked_items() {
		let checked_values = this.get_checked_values();
		return this.results.filter(res => checked_values.includes(res.date));
	}

	make_list_row(result = {}) {
		var me = this;
		let head = Object.keys(result).length === 0;
		let contents = ``;
		let columns = [];
		let custom_columns = {...this.display_columns}
		if ($.isArray(custom_columns)) {
			for (let df of custom_columns) {
				columns.push(df.fieldname);
			}
		} else {
			columns = columns.concat(Object.keys(custom_columns));
		}
		columns.forEach(function (column) {
			if (column === "Item Name") {
				contents += `<div class="list-item__content ellipsis" style="flex: 45%">
				${
					head ? `<span class="ellipsis text-muted" title="${__(frappe.model.unscrub(column))}" >${__(frappe.model.unscrub(column))}</span>`
					: (column !== "date" ? `<span class="ellipsis result-row" title="${__(result[column] || '')}" style = "overflow-wrap: break-word;word-wrap: break-word;white-space: break-spaces;">${__(result[column] || '')}</span>`
					: `<a href="${"#Form/" + me.doctype + "/" + result[column] || ''}" class="list-id ellipsis" title="${__(result[column] || '')}">
					${__(result[column] || '')}</a>`)}
					</div>`;
				}
			else {
				if (column === "Item Code") {
					contents += `<div class="list-item__content ellipsis" style="flex: 10%">
					${
						head ? `<span class="ellipsis text-muted" title="${__(frappe.model.unscrub(column))}" >${__(frappe.model.unscrub(column))}</span>`
						: (`<span class="ellipsis result-row" title="${__(result[column] || '')}">
						<div>
						<a href="#" data-value="${__(result[column] || '')}"> ${__(result[column] || '')}</a>
						</div>
						</span>`)}
						</div>`;
				}
				else{
					if (column === "Brand") {
						contents += `<div class="list-item__content ellipsis" style="flex: 15%">
					${
						head ? `<span class="ellipsis text-muted" title="${__(frappe.model.unscrub(column))}" >${__(frappe.model.unscrub(column))}</span>`
						: (column !== "date" ? `<span class="ellipsis result-row" title="${__(result[column] || '')}" style = "overflow-wrap: break-word;word-wrap: break-word;white-space: break-spaces;">${__(result[column] || '')}</span>`
						: `<a href="${"#Form/" + me.doctype + "/" + result[column] || ''}" class="list-id ellipsis" title="${__(result[column] || '')}">
						${__(result[column] || '')}</a>`)}
						</div>`;
					}
					else if (column === "Selling Price") {				
						contents += `<div class="list-item__content ellipsis" style="flex: 15%">
					${
						head ? `<span class="ellipsis text-muted" title="${__(frappe.model.unscrub(column))}" >${__(frappe.model.unscrub(column))}</span>`
						: (frappe.user_roles.includes("Chief Sales Officer") && result["Valuation Rate"] && result["Selling Price"] < result["Valuation Rate"] ? `<span class="ellipsis result-row" style="color: red; overflow-wrap: break-word;word-wrap: break-word;white-space: break-spaces;" title="${__(result[column] || 0)}">${__(result[column] || 0)}</span>`
						: `<a href="${"#Form/" + me.doctype + "/" + result[column] || 0}" class="list-id ellipsis" title="${__(result[column] || 0)}">
						${__(result[column] || 0)}</a>`)}
						</div>`;
					}
					else {
						contents += `<div class="list-item__content ellipsis" style="flex: 10%">
					${
						head ? `<span class="ellipsis text-muted" title="${__(frappe.model.unscrub(column))}" >${__(frappe.model.unscrub(column))}</span>`
						: (column !== "date" ? `<span class="ellipsis result-row" title="${__(result[column] || '')}" style = "overflow-wrap: break-word;word-wrap: break-word;white-space: break-spaces;">${__(result[column] || '')}</span>`
						: `<a href="${"#Form/" + me.doctype + "/" + result[column] || ''}" class="list-id ellipsis" title="${__(result[column] || '')}">
						${__(result[column] || '')}</a>`)}
						</div>`;
					}
				}
			}
		});
		let $row = $(`<div class="list-item" style="z-index: 1;height: auto;align-items: baseline;padding-left:unset;" >
			<div class="list-item__content">
				<div class="list-row-check" data-item-name='{"item_code":${(result["Item Code"]) ? "\"" + result["Item Code"].toString() + "\"" : "\"\""}, "rate":${result["Selling Price"] || 0},"batch":${ (result["Batch"]) ? "\""+result["Batch"].toString()+ "\"" : "\"\"" }}' ${result.checked ? 'checked' : ''}></div>
			</div>
			${contents}
		</div>`);
		head ? $row.addClass('list-item--head').css("height","40px").css("align-items","unset")
			: $row = $(`<div class="list-item-container" data-item-name='{"item_code":${(result["Item Code"]) ? "\"" +result["Item Code"].toString() +"\"" : "\"\""},"item_name":${(result["Item Name"]) ? "\"" +result["Item Name"].toString() +"\"" : "\"\""}, "rate":${result["Selling Price"] || 0},"batch":${ (result["Batch"]) ? "\"" + result["Batch"].toString()+ "\"" : "\"\""  },"brand":${ (result["Brand"]) ? "\"" + result["Brand"].toString() + "\"" : "\"\"" }}'></div>`).append($row);
		$(".modal-dialog .list-item--head").css("z-index", 1);
		$(".modal-dialog .shaded-section").css("overflow", 'scroll');
		$(".modal-dialog .shaded-section").css("display", 'grid');
		
		// Add direct click handler to each row for immediate response
		if (!head) {
			// Make the row visually clickable
			$row.css('cursor', 'pointer');
			
			// Try multiple event types to catch the click
			$row.on('click mousedown touchend', function (e) {
				console.log('Direct row event fired!', e.type);
				
				// Don't handle checkbox clicks
				if ($(e.target).is(':checkbox') || $(e.target).closest(':checkbox').length) {
					console.log('Direct: Checkbox click ignored');
					return;
				}
				
				// Stop event propagation to prevent other handlers
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
				
				let data = {};		
				let dataItemName = $(this).attr('data-item-name');
				console.log('Direct: Data item name:', dataItemName);
				
				if(dataItemName){
					try {
						data = JSON.parse(dataItemName);
						console.log('Direct: Parsed data:', data);
					} catch (error) {
						console.error('Direct: Error parsing data:', error);
						return;
					}
				}
				
				if(data && data.item_code){
					me.open_quantity_dialog(data);
				} else {
					console.log('Direct: No data found or invalid data');
				}
			});
		}
		
		return $row;
	}

	render_result_list(results, more = 0, empty = true) {
		var me = this;
		var more_btn = me.dialog.fields_dict.more_btn.$wrapper;
		if (!frappe.flags.auto_scroll && empty) {
			this.empty_list();
		}
		if (results.length === 0) return;
		more_btn.show();
		let checked = this.get_checked_values();
		results
			.filter(result => !checked.includes(result.date))
			.forEach(result => {
				me.$results.append(me.make_list_row(result));
			});
		if (frappe.flags.auto_scroll) {
			this.$results.animate({ scrollTop: me.$results.prop('scrollHeight') }, 500);
		}
		
		// Ensure event handlers are set up for newly added results
		setTimeout(() => {
			me.setup_row_click_events();
		}, 50);
	}

	empty_list() {
		let checked = this.get_checked_items().map(item => {
			return {
				...item,
				checked: true
			};
		});
		this.$results.find('.list-item-container').remove();
		this.render_result_list(checked, 0, false);
	}

	get_results() {
		let me = this;

		if (this.active_request) {
			this.active_request.abort();
			this.active_request = null;
		}
		let filters = this.get_query ? this.get_query().filters : {} || {};
		let filter_fields = [];
		if ($.isArray(this.setters)) {
			for (let df of this.setters) {
				filters[df.fieldname] = me.dialog.fields_dict[df.fieldname].get_value() || undefined;
				me.args[df.fieldname] = filters[df.fieldname];
				filter_fields.push(df.fieldname);
			}
		} else {
			Object.keys(this.setters).forEach(function (setter) {
				var value = me.dialog.fields_dict[setter].get_value();
				if (me.dialog.fields_dict[setter].df.fieldtype == "Data" && value) {
					filters[setter] = ["like", "%" + value + "%"];
				} else {
					filters[setter] = value || undefined;
					me.args[setter] = filters[setter];
					filter_fields.push(setter);
				}
			});
		}

		let filter_group = this.get_custom_filters();

		Object.assign(filters, filter_group);
		let args = {
			filters:{
				item_code: me.dialog.fields_dict["item_code"].get_value(),
				brand: JSON.stringify(me.dialog.fields_dict["brand"].get_value()),
				txt: me.dialog.fields_dict["txt"].get_value(),
				item_group: me.dialog.fields_dict["item_group"].get_value(),
				country_of_origin: me.dialog.fields_dict["country_of_origin"].get_value(),
				warehouse:(cur_frm.doctype != "Stock Entry")?((cur_frm.doc.set_warehouse)?cur_frm.doc.set_warehouse :''):((cur_frm.doc.from_warehouse)?cur_frm.doc.from_warehouse :''),
				price_list:(cur_frm.doc.selling_price_list)?cur_frm.doc.selling_price_list :'',
				exclude_zero_quantity: me.dialog.fields_dict["exclude_zero_quantity"].get_value(),
				doc_type: cur_frm.doctype
			}
		};
		this.active_request = frappe.call({
			type: "GET",
			body:args,
			method: this.custom_method,
			no_spinner: true,
			args: args,
			callback: function (data) {
				let more = 0;
				me.results = [];
				if(data.message) {
					if (data.message.values.length) {
						if (data.message.values.length > me.page_length) {
							data.message.values.pop();
							more = 1;
						}
						data.message.values.forEach(function (result) {
							result.checked = 0;
							me.results.push(result);
						});
					}
				}
				me.render_result_list(me.results, more);
			}
		});
	}
};
