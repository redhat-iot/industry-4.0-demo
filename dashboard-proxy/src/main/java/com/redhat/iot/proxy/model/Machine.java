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
package com.redhat.iot.proxy.model;

import javax.xml.bind.annotation.XmlRootElement;
import java.io.Serializable;
import java.util.List;

@XmlRootElement(name="machine")
public class Machine implements Serializable {

    private String name;
    private String desc;
    private String status;
    private String mid;
    private String currentLid;
    private String currentFid;

    public Machine() {

    }

    public String getDesc() {
        return desc;
    }

    public void setDesc(String desc) {
        this.desc = desc;
    }

    public String getCurrentLid() {
        return currentLid;
    }

    public void setCurrentLid(String currentLid) {
        this.currentLid = currentLid;
    }

    public String getCurrentFid() {
        return currentFid;
    }

    public void setCurrentFid(String currentFid) {
        this.currentFid = currentFid;
    }

    private List<Telemetry> telemetry;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public List<Telemetry> getTelemetry() {
        return telemetry;
    }

    public void setTelemetry(List<Telemetry> telemetry) {
        this.telemetry = telemetry;
    }

    public String getMid() {
        return mid;
    }

    public void setMid(String mid) {
        this.mid = mid;
    }
}
