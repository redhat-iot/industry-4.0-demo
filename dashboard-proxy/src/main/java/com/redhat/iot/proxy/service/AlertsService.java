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

import static com.redhat.iot.proxy.rest.UtilsEndpoint.MS_IN_HOUR;

@ApplicationScoped
public class AlertsService implements MqttCallback {

    private static final int MAX_RECONNECT_ATTEMPTS = 100;
    private static final Pattern TOPIC_PATTERN = Pattern.compile("[^/]*/[^/]*/[^/]*/facilities/([^/]*)/lines/([^/]*)/machines/([^/]*)/alerts");
    private MqttClient mqttClient;

    final private List<Alert> alerts = Collections.synchronizedList(new ArrayList<>());
    @Inject DGService dgService;

    private static final Logger log = Logger.getLogger(AlertsService.class.getName());
    public AlertsService() {

        String brokerHost = System.getenv("BROKER_HOSTNAME");
        String brokerPort = System.getenv("BROKER_PORT");

        if (brokerHost == null || brokerPort == null) {
            throw new IllegalArgumentException("BROKER_HOSTNAME or BROKER_PORT not set, cannot process alerts");
        }


        MemoryPersistence persistence = new MemoryPersistence();
        String broker = "tcp://" + brokerHost + ":" + brokerPort;
        try {
            mqttClient = new MqttClient(broker, "dashboard-proxy-" + UUID.randomUUID().toString(), persistence);
        } catch (MqttException e) {
            e.printStackTrace();
        }

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

        for (int i = 0; i < MAX_RECONNECT_ATTEMPTS; i++) {
            try {


                MqttConnectOptions connOpts = new MqttConnectOptions();
                connOpts.setUserName(System.getenv("BROKER_USERNAME"));
                connOpts.setPassword(System.getenv("BROKER_PASSWORD").toCharArray());

                connOpts.setCleanSession(true);
                connOpts.setKeepAliveInterval(10);
                connOpts.setConnectionTimeout(60);
                log.info("Attempt " + (i+1) + " of " + MAX_RECONNECT_ATTEMPTS + ": Connecting to broker: " + mqttClient.getServerURI());
                mqttClient.connect(connOpts);
                log.info("Connected");

                mqttClient.setCallback(this);
                log.info("Subscribing");
                mqttClient.subscribe("+/+/+/facilities/+/lines/+/machines/+/alerts");

                log.info("Subscribed");
                break;
            } catch (Exception me) {
                log.info("Could not connect to " + mqttClient.getServerURI());
                log.info("msg " + me.getMessage());
                log.info("loc " + me.getLocalizedMessage());
                log.info("cause " + me.getCause());
                log.info("excep " + me);
                me.printStackTrace();
            }
            try {
                log.info("Waiting for 10s to retry");
                Thread.sleep(10000);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    public void connectionLost(Throwable throwable)  {
        log.info("CONNECTION LOST: " + throwable.getMessage() + " cause: " + throwable.getCause().getMessage());
        try {
            if (mqttClient.isConnected()) {
                log.info("Disconnecting from client");
                mqttClient.disconnect();
                log.info("Attempting to reconnect in 5s");
                Thread.sleep(5000);
                subscribeToAlerts();
            }
        } catch (Exception ignored) {
        }
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

//    {
//		“id”: “D846E916-FA87-4ACE-97A6-D0C91C5116C6”,
//      “description”: “Maintenance Required”,
//      “timestamp”: 1503599719963,
//      “type”: “maintenance”,
//      “details”: {
//	        “reason”: “Machine is operating outside nominal values”,
//	        “start”: 1503599819963,
//	        “end”: 1503699819963
//      }
//    }


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

        JSONObject j = new JSONObject(payload);

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
            log.info("OK alert received - Returning to normal");
            line.setStatus("ok");
            dgService.getProductionLines().put(fid + "/" + lid, line);
            machine.setStatus("ok");
            dgService.getMachines().put(fid + "/" + lid + "/" + mid, machine);
            clearAlertsForLine(line);
            dgService.getFacilities().put(fid, facility);
        } else if ("warning".equalsIgnoreCase(type)) {
            log.info("WARNING alert received");
            line.setStatus("warning");
            dgService.getProductionLines().put(fid + "/" + lid, line);
            machine.setStatus("warning");
            dgService.getMachines().put(fid + "/" + lid + "/" + mid, machine);
            addAlert(new Alert(date, id, desc, details.toString(), type, line, machine));
            dgService.getFacilities().put(fid, facility);

        } else if ("error".equalsIgnoreCase(type)) {
            log.info("ERROR alert received");
            line.setStatus("error");
            dgService.getProductionLines().put(fid + "/" + lid, line);
            machine.setStatus("error");
            dgService.getMachines().put(fid + "/" + lid + "/" + mid, machine);
            addAlert(new Alert(date, id, desc, details.toString(), type, line, machine));
            dgService.getFacilities().put(fid, facility);

            log.info("Adding MAINTENANCE cal entry");
            String reason = getStringObj(details, "reason");
            Long mStart = new Date().getTime();
            Long mEnd = mStart + MS_IN_HOUR;

            CalEntry calEntry = new CalEntry();
            calEntry.setStart(new Date(mStart));
            calEntry.setEnd(new Date(mEnd));
            calEntry.setFacility(facility);
            calEntry.setTitle("Line SHUTDOWN: " + line.getLid());
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
            dgService.getCalendar().put(UUID.randomUUID().toString(), calEntry);


        } else if ("maintenance".equalsIgnoreCase(type)) {
            log.info("MAINTENANCE alert received");
            String reason = getStringObj(details, "reason");
            Long mStart = getLongObj(details, "start");
            Long mEnd = getLongObj(details, "end");

            CalEntry calEntry = new CalEntry();
            calEntry.setStart(new Date(mStart));
            calEntry.setEnd(new Date(mEnd));
            calEntry.setFacility(facility);
            calEntry.setTitle("Line Maintenance: " + line.getLid());
            calEntry.setColor("#f7bd7f");
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
            dgService.getCalendar().put(UUID.randomUUID().toString(), calEntry);

        } else {
            log.info("Unknown alert type (" + type + "), ignoring");
        }

    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken iMqttDeliveryToken) {
        log.fine("DELIVERY COMPLETE?");

    }
}

