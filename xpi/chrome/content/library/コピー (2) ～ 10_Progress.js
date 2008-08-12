function Progress(name, max, value){
	this.name = name!=null? name : '';
	this._max = max!=null? max : 100;
	this._value = value!=null? value : 0;
	
	this._canceled = false;
	this.closed = false; // for max == 0
	
	this.children = [];
	this.cancelListeners = [];
	this.progressListeners = [];
}

Progress.prototype = {
	toString : function(){
		return this.name + ': ' + (this.max && this.value? this.value + ' / ' + this.max : '');
	},
	
	get percentage(){
		return this.max? Math.min(Math.floor(this.value / this.max * 100), 100) : 100;
	},
	
	get max(){
		return this._max;
	},
	
	set max(max){
		this._max = Math.max(max, 0);
		if(this.max!=0)
			this.closed = false;
		
		this.value = this.value;
	},
	
	get value(){
		if(this._value || !this.children.length)
			return this._value;
		
		var self = this;
		var totalScale = 0;
		this.children.forEach(function(p){
			totalScale+=p.scale;
		})
		
		var value = 0;
		this.children.forEach(function(p){
			value+=(self.max * (p.scale / totalScale)) * (p.percentage / 100);
		})
		
		return Math.floor(value);
	},
	
	set value(value){
		if(this.closed || this._canceled || (this.max!=0 && this.value == value))
			return;
		
		this._value = Math.max(Math.min(value, this.max), 0);
		
		if(this.max==0)
			this.closed = true;
		
		this.parent && this.parent.notify(this.parent.progressListeners, this.parent, this);
		this.notify(this.progressListeners, this, this);
	},
	
	get ended(){
		return this.completed || this.canceled;
	},
	
	get completed(){
		return this.percentage==100;
	},
	
	notify : function(listeners, target, trigger){
		listeners.forEach(function(listner){
			listner(target, trigger);
		})
	},
	
	get canceled(){
		return this._canceled || this.children.some(function(p){return p.canceled});
	},
	
	cancel : function(){
		if(this._canceled)
			return;
		
		this._canceled = true;
		
		this.parent && this.parent.cancel();
		this.children.forEach(function(p){
			p.cancel();
		})
		this.notify(this.cancelListeners, this, this);
	},
	
	complete : function(){
		this.value = this.max;
	},
	
	addChild : function(progress, scale){
		progress.scale = scale==null? 100 : scale;
		progress.parent = this;
		this.children.push(progress);
		return progress;
	},
	
	addCancelListener : function(func){
		this.cancelListeners.push(func);
	},
	
	addProgressListener : function(func){
		this.progressListeners.push(func);
	},
};
