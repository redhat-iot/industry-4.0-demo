/*
 * ******************************************************************************
 * Copyright (c) 2017 Red Hat, Inc. and others
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Red Hat Inc. - initial API and implementation
 *
 * ******************************************************************************
 */
package com.redhat.iot.proxy.service;

import com.redhat.iot.proxy.model.*;
import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.json.JSONArray;
import org.json.JSONObject;

import javax.enterprise.context.ApplicationScoped;
import javax.enterprise.context.Destroyed;
import javax.enterprise.context.Initialized;
import javax.enterprise.event.Observes;
import javax.inject.Inject;
import java.util.*;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@ApplicationScoped
public class AlertsService implements MqttCallbackExtended {

    private static final String ALERTS_TOPIC_SUBSCRIPTION = "+/+/+/facilities/+/lines/+/machines/+/alerts";
    private static final Pattern TOPIC_PATTERN = Pattern.compile("[^/]*/[^/]*/[^/]*/facilities/([^/]*)/lines/([^/]*)/machines/([^/]*)/alerts");
    private MqttClient mqttClient;
    private long lastOk = 0;
    final private List<Alert> alerts = Collections.synchronizedList(new ArrayList<>());
    @Inject
    DGService dgService;

    private static final Logger log = Logger.getLogger(AlertsService.class.getName());

    public AlertsService() {

        MemoryPersistence persistence = new MemoryPersistence();
        String broker = System.getenv("EC_BROKER_MQTT_PORT");
        try {
            mqttClient = new MqttClient(broker, "dashboard-proxy-" + UUID.randomUUID().toString(), persistence);
        } catch (MqttException e) {
            e.printStackTrace();
        }

    }

    public boolean isConnected() {
        return mqttClient.isConnected();
    }

    private void addAlert(Alert alert) {
        alerts.add(alert);
    }

    public List<Alert> getAlerts() {
        return alerts;
    }

    public void clearAlertsForLine(Line v) {
        synchronized (alerts) {
            List<Alert> toRemove = new ArrayList<>();
            for (Alert alert : alerts) {
                if (alert.getLine().getLid().equals(v.getLid())) {
                    toRemove.add(alert);
                }
            }
            alerts.removeAll(toRemove);
        }
    }

    public void init(@Observes @Initialized(ApplicationScoped.class) Object init) {

        subscribeToAlerts();

    }

    public void destroy(@Observes @Destroyed(ApplicationScoped.class) Object init) throws Exception {

        mqttClient.disconnect();
        mqttClient.close();
    }

    private void subscribeToAlerts() {

        if (mqttClient == null) {
            log.warning("broker unable to be initialized, cannot subscribe to alerts");
            return;
        }

        try {
            MqttConnectOptions connOpts = new MqttConnectOptions();
            connOpts.setUserName(System.getenv("BROKER_USERNAME"));
            connOpts.setPassword(System.getenv("BROKER_PASSWORD").toCharArray());

            connOpts.setCleanSession(true);
            connOpts.setKeepAliveInterval(10);
            connOpts.setConnectionTimeout(60);
            connOpts.setAutomaticReconnect(true);
            log.info("Connecting to broker: " + mqttClient.getServerURI());
            mqttClient.setCallback(this);
            mqttClient.connect(connOpts);
            log.info("Connected to broker: " + mqttClient.getServerURI());

        } catch (Exception me) {
            log.info("Could not connect to " + mqttClient.getServerURI());
            log.info("msg: " + me.getMessage());
            log.info("localized msg: " + me.getLocalizedMessage());
            log.info("cause: " + me.getCause());
            log.info("exception: " + me);
            me.printStackTrace();
        }
    }

    @Override
    public void connectionLost(Throwable throwable) {
        log.info("CONNECTION LOST: " + throwable.getMessage() + " cause: " + throwable.getCause().getMessage());
//        try {
//            mqttClient.reconnect();
//        } catch (MqttException ex) {
//            log.info("Cannot disconnect/reconnect: " + ex.getMessage());
//            ex.printStackTrace();
//        }
    }

    private Long getLongObj(JSONObject dic, String key) {
        if (!dic.has(key) || dic.isNull(key)) {
            return null;
        } else {
            return dic.getLong(key);
        }
    }

    private String getStringObj(JSONObject dic, String key) {
        if (!dic.has(key) || dic.isNull(key)) {
            return null;
        } else {
            return dic.getString(key).trim();
        }
    }

    @Override
    public void messageArrived(String topic, MqttMessage mqttMessage) throws Exception {

        String payload = mqttMessage.toString();

        log.info("ALERT ARRIVED FOR TOPIC " + topic + " payload: " + payload);

        Matcher matcher = TOPIC_PATTERN.matcher(topic);
        if (!matcher.matches()) {
            log.info(topic + " does not match expected pattern, ignoring");
            return;
        }

        String fid = matcher.group(1);
        String lid = matcher.group(2);
        String mid = matcher.group(3);

        Facility facility = dgService.getFacilities().get(fid);
        if (facility == null) {
            log.info("Facility " + fid + " not found, ignoring alert");
            return;
        }

        Line line = null;
        Machine machine = null;

        for (Line l : facility.getLines()) {
            if (l.getLid().equals(lid)) {
                line = l;
                for (Machine m : l.getMachines()) {
                    if (m.getMid().equals(mid)) {
                        machine = m;
                        break;
                    }
                }
                break;
            }
        }
        if (line == null) {
            log.info("Line " + lid + " not found, ignoring alert");
            return;
        }

        if (machine == null) {
            log.info("Machine " + mid + " not found, ignoring alert");
            return;
        }

        JSONObject j;
        try {
            j = new JSONObject(payload);
        } catch (Exception ex) {
            log.info("Unable to parse payload: " + ex.getMessage() + ", ignoring alert");
            return;
        }

        Long dateObj = getLongObj(j, "timestamp");
        if (dateObj == null) {
            dateObj = new Date().getTime();
        }

        Date date = new Date(dateObj);

        String id = getStringObj(j, "id");
        String desc = getStringObj(j, "description");
        String type = getStringObj(j, "type");

        JSONObject details = new JSONObject();

        if (j.has("details")) {
            details = j.getJSONObject("details");
        }

        log.info("machine:" + machine.getMid() + " line:" + line.getLid() + " facility: " + facility.getFid());
        if ("ok".equalsIgnoreCase(type)) {
            lastOk = new Date().getTime();
            log.info("OK alert received - Returning to normal");
            line.setStatus("ok");
            dgService.getProductionLines().put(fid + "/" + lid, line);
            machine.setStatus("ok");
            machine.setStatusMsg("ok");
            dgService.getMachines().put(fid + "/" + lid + "/" + mid, machine);
            clearAlertsForLine(line);
            dgService.getFacilities().put(fid, facility);
        } else if ("warning".equalsIgnoreCase(type)) {
            log.info("WARNING alert received");
            if (new Date().getTime() < (lastOk + 5000)) {
                // ignore warnings for some time after last OK
                log.info("ignoring alerts for 5 seconds since last OK");
                return;
            }
            if (!"ok".equalsIgnoreCase(machine.getStatus())) {
                // ignore warnings for machine already in warning state
                log.info("Ignoring warning for machine already not in OK state");
                return;
            }
            line.setStatus("warning");
            dgService.getProductionLines().put(fid + "/" + lid, line);
            machine.setStatus("warning");
            machine.setStatusMsg(desc);
            dgService.getMachines().put(fid + "/" + lid + "/" + mid, machine);
            addAlert(new Alert(date, id, desc, details.toString(), type, line, machine));
            dgService.getFacilities().put(fid, facility);

        } else if ("error".equalsIgnoreCase(type)) {
            log.info("ERROR alert received");
            if (new Date().getTime() < (lastOk + 5000)) {
                // ignore warnings for some time after last OK
                log.info("ignoring alerts for 5 seconds since last OK");
                return;
            }
            if (!"ok".equalsIgnoreCase(machine.getStatus())) {
                // ignore error for machine already in error
                log.info("Ignoring error for machine already not in OK state");
                return;
            }
            line.setStatus("error");
            dgService.getProductionLines().put(fid + "/" + lid, line);
            machine.setStatus("error");
            machine.setStatusMsg(desc);
            dgService.getMachines().put(fid + "/" + lid + "/" + mid, machine);
            addAlert(new Alert(date, id, desc, details.toString(), type, line, machine));
            dgService.getFacilities().put(fid, facility);

            log.info("MAINTENANCE alert added for error");
            try {

                String reason = getStringObj(details, "reason");
                Long mStart = getLongObj(details, "start");
                Long mEnd = getLongObj(details, "end");

                CalEntry calEntry = new CalEntry();
                calEntry.setCid(UUID.randomUUID().toString());
                if (mStart == null) {
                    mStart = new Date().getTime();
                }
                if (mEnd == null) {
                    mEnd = new Date().getTime() + (1 * 60 * 60 * 1000);
                }
                calEntry.setStart(new Date(mStart));
                calEntry.setEnd(new Date(mEnd));
                calEntry.setFacility(facility);
                calEntry.setTitle("Line Maintenance: " + line.getLid());
                calEntry.setColor("red");
                calEntry.setType("maintenance");
                JSONObject dets = new JSONObject()
                        .put("desc", reason)
                        .put("links",
                                new JSONArray()
                                        .put(
                                                new JSONObject()
                                                        .put("name", "Installation Manual")
                                                        .put("link", "http://www.redhat.com"))
                                        .put(
                                                new JSONObject()
                                                        .put("name", "Repair Manual")
                                                        .put("link", "http://developers.redhat.com"))
                        );

                calEntry.setDetails(dets.toString());
                dgService.getCalendar().put(calEntry.getCid(), calEntry);
                log.info("Added maintanence error event for facility " + facility.getFid());
            } catch (Exception ex) {
                log.info("Caught exception trying to add calendar entry for maintaence error: ");
                ex.printStackTrace();
            }


        } else if ("maintenance".equalsIgnoreCase(type)) {
            log.info("MAINTENANCE alert received");
            if (new Date().getTime() < (lastOk + 5000)) {
                // ignore warnings for some time after last OK
                log.info("ignoring alerts for 5 seconds since last OK");
                return;
            }
            if (!"ok".equalsIgnoreCase(machine.getStatus())) {
                // ignore warnings for machine already in warning state
                log.info("Ignoring maintenance request for machine not in OK state");
                return;
            }
            String reason = getStringObj(details, "reason");
            Long mStart = getLongObj(details, "start");
            Long mEnd = getLongObj(details, "end");

            CalEntry calEntry = new CalEntry();
            calEntry.setCid(UUID.randomUUID().toString());
            calEntry.setStart(new Date(mStart));
            calEntry.setEnd(new Date(mEnd));
            calEntry.setFacility(facility);
            calEntry.setTitle("Line Maintenance: " + line.getLid());
            calEntry.setColor("red");
            calEntry.setType("maintenance");
            JSONObject dets = new JSONObject()
                    .put("desc", reason)
                    .put("links",
                            new JSONArray()
                                    .put(
                                            new JSONObject()
                                                    .put("name", "Installation Manual")
                                                    .put("link", "http://www.redhat.com"))
                                    .put(
                                            new JSONObject()
                                                    .put("name", "Repair Manual")
                                                    .put("link", "http://developers.redhat.com"))
                    );

            calEntry.setDetails(dets.toString());
            dgService.getCalendar().put(calEntry.getCid(), calEntry);
            log.info("Added maintanence event for facility " + facility.getFid());

            log.info("temporarily issuing WARNING alert");
            line.setStatus("warning");
            dgService.getProductionLines().put(fid + "/" + lid, line);
            machine.setStatus("warning");
            machine.setStatusMsg(desc);
            dgService.getMachines().put(fid + "/" + lid + "/" + mid, machine);
            addAlert(new Alert(date, id, desc, details.toString(), type, line, machine));
            dgService.getFacilities().put(fid, facility);


        } else {
            log.info("Unknown alert type (" + type + "), ignoring");
        }

    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken iMqttDeliveryToken) {
        log.fine("DELIVERY COMPLETE?");

    }

    @Override
    public void connectComplete(boolean b, String s) {
        log.info("Connect complete: reconnect? " + b + " serverURI: " + s);
        log.info("Subscribing to " + ALERTS_TOPIC_SUBSCRIPTION);
        try {
            mqttClient.subscribe(ALERTS_TOPIC_SUBSCRIPTION);
        } catch (MqttException e) {
            log.warning("cannot subscribe");
            e.printStackTrace();
        }
        log.info("Subscribed to " + ALERTS_TOPIC_SUBSCRIPTION);
    }
}

