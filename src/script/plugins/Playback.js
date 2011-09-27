/**
 * Copyright (c) 2008-2011 The Open Planning Project
 * 
 * Published under the GPL license.
 * See https://github.com/opengeo/gxp/raw/master/license.txt for the full text
 * of the license.
 */

/**
 * @requires plugins/Tool.js
 */

/** api: (define)
 *  module = gxp.plugins
 *  class = Playback
 */

/** api: (extends)
 *  plugins/Tool.js
 */
Ext.namespace("gxp.plugins");

/** api: constructor
 *  .. class:: Playback(config)
 *
 *    Provides a configurable playback control for playing temporally enabled maps
 */
gxp.plugins.Playback = Ext.extend(gxp.plugins.Tool, {
    
    /** api: ptype = gxp_playback */
    ptype: "gxp_playback",
    actionTarget:null,
    initialTime:null,
    rangedPlayInterval:null, //hide this as just a config
    timeFormat:"l, F d, Y g:i:s A",
    slider:true,
    dynamicRange:true,
    //api config
    //playback mode is one of: "track","cumulative","ranged",??"decay"??
    playbackMode:"track",
    showIntervals:false,
    labelButtons:false,
    settingsButton:true,
    rateAdjuster:false,
    //api property
    settingsPanel:null,
    // api config
    //playbackActions, default: ["settings","reset","play","fastforward","next","loop"]; also available are "pause" and "end"
    
    //i18n
    /** api: config[playLabel]
     *  ``String``
     *  Text for play button label (i18n).
     */
    playLabel:'Play',
    /** api: config[playTooltip]
     *  ``String``
     *  Text for play button tooltip (i18n).
     */
    playTooltip:'Play',
    stopLabel:'Stop',
    stopTooltip:'Stop',
    fastforwardLabel:'FFWD',
    fastforwardTooltip:'Double Speed Playback',
    nextLabel:'Next',
    nextTooltip:'Advance One Frame',
    resetLabel:'Reset',
    resetTooltip:'Reset to the start',
    loopLabel:'Loop',
    loopTooltip:'Continously loop the animation',
    normalTooltip:'Return to normal playback',
    pauseLabel:'Pause',
    pauseTooltip:'Pause',

    /** private: method[constructor]
     */
    constructor: function(config) {
        gxp.plugins.Playback.superclass.constructor.apply(this, arguments);
        Ext.applyIf(this,{
            playbackActions:["settings","slider","reset","play","fastforward","next","loop"],
            control:this.buildTimeManager(),
            outputTarget:'map',
            outputConfig:{'xtype':'tip',format:this.timeFormat,height:'auto',closeable:false,title:false,width:210}
        })
    },

    /** api: method[addActions]
     */
    addActions: function() {
        this.slider && this.target.on({
            'ready': this.configureSlider,
            scope: this
        })
        !this.control.map && this.target.mapPanel.map.addControl(this.control);
        var actions = this.buildActions();
        //only add actions if we have a real action target that is not 'map'
        if(this.actionTarget){
            var targets = this.actionTarget instanceof Array ? this.actionTarget : [this.actionTarget]
            if((mapIndex = targets.indexOf('map'))>-1){
                targets.splice(mapIndex,1);
            }
            return gxp.plugins.Playback.superclass.addActions.apply(this, [actions]);
        }
        else{
            var panel = this.timePanel = this.buildTimePanel(actions);
            panel.render(this.target.mapPanel.id);
            panel.show();
            panel.el.alignTo(this.target.mapPanel.getEl(),'tl-tl',[80,60]);
            this.outputConfig.defaultAlign = 't-b';
            panel.btnPlay.on({
                "click": function(){
                    this.addOutput(this.outputConfig)
                },
                scope: this,
                single: true
            });
        }
    },
    addOutput: function(config){
        Ext.applyIf(this.outputConfig,{html:this.control.currentTime.format(this.timeFormat)})
        var output = gxp.plugins.Playback.superclass.addOutput.apply(this,[config]);
        output.show();
        if(this.actionTarget){
            output.el.alignTo(this.target.mapPanel.getEl(),'tl-tl',[60,60])
        }else{
            output.el.alignTo(this.timePanel.timeSlider.getEl(), output.defaultAlign, [0, 5])
        }
    },
    /** private: method[buildActions]
     */
    buildActions: function(){
        var actionDefaults = {
            'slider':{
            xtype: 'multislider',
            ref:'timeSlider',
            values:[0],
            width:200,
            animate:false,
            format:this.timeFormat,
            plugins: new Ext.slider.Tip({
                getText: function(thumb){
                    if (thumb.slider.indexMap[thumb.index] != 'tail') {
                        return (new Date(thumb.value).format(thumb.slider.format));
                    }else{
                        var formatInfo = gxp.plugins.Playback.prototype.smartIntervalFormat.call(thumb,thumb.slider.thumbs[0].value-thumb.value);
                        return formatInfo.value + ' ' +formatInfo.units;
                    }
                }
            }),
            listeners:{
                'changecomplete':this.onSliderChangeComplete,
                scope:this
            }
        },
            'reset': {
                iconCls: 'gxp-icon-reset',
                ref:'btnReset',
                handler: this.control.reset,
                scope: this.control,
                tooltip: this.resetTooltip,
                menuText: this.resetLabel,
                text: (this.labelButtons) ? this.resetLabel : false
            },
            'pause': {
                iconCls: 'gxp-icon-pause',
                ref:'btnPause',
                handler: this.control.stop,
                scope: this.control,
                tooltip: this.stopTooltip,
                menuText: this.stopLabel,
                text: (this.labelButtons) ? this.stopLabel : false,
                toggleGroup: 'timecontrol',
                enableToggle: true,
                allowDepress: false
            },
            'play': {
                iconCls: 'gxp-icon-play',
                ref:'btnPlay',
                toggleHandler: this.toggleAnimation,
                scope: this,
                toggleGroup: 'timecontrol',
                enableToggle: true,
                allowDepress: true,
                tooltip: this.playTooltip,
                menuText: this.playLabel,
                text: (this.labelButtons) ? this.playLabel : false
            },
            'next': {
                iconCls: 'gxp-icon-last',
                ref:'btnNext',
                handler: this.control.tick,
                scope: this.control,
                tooltip: this.nextTooltip,
                menuText: this.nextLabel,
                text: (this.labelButtons) ? this.nextLabel : false
            },
            'end': {
                iconCls: 'gxp-icon-last',
                ref:'btnEnd',
                handler: this.forwardToEnd,
                scope: this,
                tooltip: this.endTooltip,
                menuText: this.endLabel,
                text: (this.labelButtons) ? this.endLabel : false
            },
            'loop': {
                iconCls: 'gxp-icon-loop',
                ref:'btnLoop',
                tooltip: this.loopTooltip,
                enableToggle: true,
                allowDepress: true,
                toggleHandler: this.toggleLoopMode,
                scope: this,
                tooltip: this.loopTooltip,
                menuText: this.loopLabel,
                text: (this.labelButtons) ? this.loopLabel : false,
            },
            'fastforward': {
                iconCls: 'gxp-icon-ffwd',
                ref:'btnFastforward',
                tooltip: this.fastforwardTooltip,
                enableToggle: true,
                allowDepress: true,
                toggleHandler: this.toggleDoubleSpeed,
                scope: this,
                disabled:true,
                tooltip: this.fastforwardTooltip,
                menuText: this.fastforwardLabel,
                text: (this.labelButtons) ? this.fastforwardLabel : false,
            },
            'settings': {
                iconCls: 'gxp-icon-settings',
                ref:'btnSettings',
                handler: this.openSettingsPanel,
                scope: this,
                tooltip: this.settingsTooltip,
                menuText: this.settingsLabel,
                text: (this.labelButtons) ? this.settingsLabel : false
            }
        }
        var actConfigs = this.playbackActions;
        var actions =[];
        for(var i=0,len=actConfigs.length;i<len;i++){
            var cfg = actConfigs[i];
            if(typeof cfg == 'string')cfg = actionDefaults[cfg];
            else if(!(Ext.isObject(cfg) || cfg instanceof Ext.Component || cfg instanceof Ext.Action || cfg instanceof GeoExt.Action)){
                console.error("playbackActions configurations must be a string, valid action, component, or config");
                cfg=null;
            }
            if(cfg){
                if(cfg==actionDefaults.play){this.outputAction=i}
                //actions interface won't work with regular component config objects. needs instantiated components
                if(cfg.xtype)cfg=this[cfg.ref||cfg.xtype]=Ext.create(cfg);
                actions.push(cfg);
            }
        }
        return actions;
    },
    buildSliderValues:function(){
      var indexMap = ['primary'],
      values = [this.control.currentTime.getTime()],
      min=this.control.range[0].getTime(),
      max=this.control.range[1].getTime(),
      then=new Date(min),
      interval=then['setUTC' + this.control.units](then['getUTC' + this.control.units]() + this.control.step) - min;
      if(this.dynamicRange){
        var rangeAdj = (min-max)*.1;
        values.push(min=min-rangeAdj,max=max+rangeAdj);
        indexMap[1]='minTime',indexMap[2]='maxTime';
      }
      if(this.playbackMode=='ranged'||this.playbackMode=='decay'){
        values.push(min);
        indexMap[indexMap.length]='tail'
      }
      return {'values':values,'map':indexMap,'maxValue':max,'minValue':min,'interval':interval}
    },
    buildTimeManager:function(){
        this.controlOptions || (this.controlOptions={})
        if(this.playbackMode=='ranged' || this.playbackMode=='decay'){
            Ext.apply(this.controlOptions,{
                agentOptions:{
                    'WMS':{rangeMode:'range',rangeInterval:this.rangedPlayInterval},
                    'Vector':{rangeMode:'range',rangeInterval:this.rangedPlayInterval}
                },
            })
        }
        else if(this.playbackMode=='cumulative'){
            Ext.apply(this.controlOptions,{
                agentOptions:{
                    'WMS':{rangeMode:'cumulative'},
                    'Vector':{rangeMode:'cumulative'}
                },
            })
        }
        var ctl = new OpenLayers.Control.TimeManager(this.controlOptions);
        return ctl;
    },
    buildTimePanel:function(actions){
        return new Ext.Panel({
            layout:'hbox',
            width:400,
            hideMode:'visibility',
            cls:'gx-overlay-playback',
            defaults:{xtype:'button',flex:1,scale:'small'},
            items:[actions],
            border:false,
            frame:false,
            unstyled:true,
            floating:true,
            shadow:false
        });
    },
    configureSlider: function(){
        if(this.playbackMode=='ranged' || this.playbackMode=='decay'){
            this.control.incrementTime(this.rangedPlayInterval,this.control.units)
        }
        var sliderInfo = this.buildSliderValues(),
        slider = this.timeSlider,
        tool = this;
        Ext.apply(slider, {
            increment: sliderInfo.interval,
            keyIncrement: sliderInfo.interval,
            indexMap: sliderInfo.map
        })
        slider.setMaxValue(sliderInfo.maxValue);
        slider.setMinValue(sliderInfo.minValue);
        for (var i = 0; i < sliderInfo.values.length; i++) {
            if (slider.thumbs[i]) {slider.setValue(i,sliderInfo.values[i])}
            else {slider.addThumb(sliderInfo.values[i])}
        }
        tailIndex = slider.indexMap.indexOf('tail');
        if(slider.indexMap[1]=='min'){
            slider.thumbs[1].el.addClass('x-slider-min-thumb');
            slider.thumbs[2].el.addClass('x-slider-max-thumb');
        }
        if(tailIndex>-1){
            slider.thumbs[tailIndex].el.addClass('x-slider-tail-thumb');
            slider.thumbs[tailIndex].constrain=false;
            slider.thumbs[0].constrain=false;
        }
        this.control.events.register('tick',this.control,function(evt){
            var offset = evt.currentTime.getTime()-slider.values[0];
            slider.setValue(0,slider.thumbs[0].value+offset);
            if(tailIndex>-1)slider.setValue(tailIndex,slider.thumbs[tailIndex].value+offset)
            tool.output[0] && tool.output[0].update(evt.currentTime.format(slider.format))
        })
    },
    forwardToEnd: function(btn){
        var ctl = this.control;
        ctl.setTime(new Date(ctl.range[(ctl.step < 0) ? 0 : 1].getTime()))
    },
    toggleAnimation:function(btn,pressed){
        this.control[pressed?'play':'stop']();
        btn.btnEl.toggleClass('gxp-icon-play').toggleClass('gxp-icon-pause');
        btn.el.removeClass('x-btn-pressed');
        btn.setTooltip(pressed?this.pauseTooltip:this.playTooltip);
        btn.refOwner.btnFastforward[pressed?'enable':'disable']();
        if(this.labelButtons && btn.text)btn.setText(pressed?this.pauseLabel:this.playLabel);
    },
    toggleLoopMode:function(btn,pressed){
        this.control.loop=pressed;
        btn.setTooltip(pressed?this.normalTooltip:this.loopTooltip);
        if(this.labelButtons && btn.text)btn.setText(pressed?this.normalLabel:this.loopLabel);
    },
    toggleDoubleSpeed:function(btn,pressed){
        this.control.frameRate = this.control.frameRate*(pressed)?2:0.5;
        this.control.stop();this.control.play();
        btn.setTooltip(pressed?this.normalTooltip:this.fastforwardTooltip);
    },
    onSliderChangeComplete: function(slider, value, thumb){
        var slideTime = new Date(value);
        //test if this is the main time slider
        switch (slider.indexMap[thumb.index]) {
            case 'primary':
                this.control.setTime(slideTime);
                !this.output[0] && this.addOutput(this.outputConfig)
                this.output[0].update(slideTime.format(this.timeFormat));
                break;
            case 'min':
                if (value >= this.control.intialRange[0].getTime()) {
                    this.control.setStart(new Date(value));
                }
                break;
            case 'max':
                if (value <= this.control.intialRange[1].getTime()) {
                    this.control.setEnd(new Date(value));
                }
                break;
            case 'tail':
                var adj = 1;
                switch (this.control.units) {
                    case OpenLayers.TimeUnit.YEARS:
                        adj *= 12;
                    case OpenLayers.TimeUnit.MONTHS:
                        adj *= (365 / 12);
                    case OpenLayers.TimeUnit.DAYS:
                        adj *= 24;
                    case OpenLayers.TimeUnit.HOURS:
                        adj *= 60;
                    case OpenLayers.TimeUnit.MINUTES:
                        adj *= 60;
                    case OpenLayers.TimeUnit.SECONDS:
                        adj *= 1000;
                        break;
                }
                this.control.rangeInterval = (slider.thumbs[0].value - value) / adj;
        }
    },
    smartIntervalFormat:function(diff){
        var unitText, diffValue, absDiff=Math.abs(diff);
        if(absDiff<6e3){
            unitText='Seconds',
            diffValue=(Math.round(diff/1e2))/10;
        }
        else if(absDiff<36e5){
            unitText='Minutes',
            diffValue=(Math.round(diff/6e2))/10;
        }
        else if(absDiff<864e5){
            unitText='Hours',
            diffValue=(Math.round(diff/36e4))/10;
        }
        else if(absDiff<2628e6){
            unitText='Days',
            diffValue=(Math.round(diff/864e4))/10;
        }
        else if(absDiff<31536e6){
            unitText='Months',
            diffValue=(Math.round(diff/2628e5))/10;
        }else{
            unitText='Years',
            diffValue=(Math.round(diff/31536e5))/10;
        }
        return {units:unitText,value:diffValue}
    }
});

Ext.preg(gxp.plugins.Playback.prototype.ptype, gxp.plugins.Playback);